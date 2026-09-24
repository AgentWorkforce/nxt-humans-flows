// Figma → React Email → Braze or Salesforce Marketing Cloud, as one relayflow.
//
//   System  check the Figma and send-platform credentials are present
//   System  fetch the email frame from Figma and export its images
//   System  map design-library instances to approved React Email components (by rule)
//   System  map every other layer to approved components (model, schema-checked, retried on findings)
//   System  render through the approved components; check size, alt text, links, unsubscribe
//   You     review email.html and approve it
//   Outcome the email is a template on the send platform (created, or updated by name)
//
//   flows run figma-to-email.flow.ts --local-agent --input \
//     '{"figmaFileKey":"<key>","figmaNodeId":"12-34","name":"2026-10 Fall launch","target":"braze","imageBaseUrl":"https://cdn.example.com/email/fall","reviewer":"<you>"}'
import { flow, type Ctx } from "@relayflows/surface";
import { mapDesign, mappingProblems, mappingPrompt, MAPPING_SCHEMA, type ModelMapping } from "./lib/map.ts";
import type { Design, Layer } from "./lib/figma.ts";
import { specProblems, type Block, type EmailSpec } from "./lib/spec.ts";
import { TARGETS, isTarget, type Receipt, type TargetName } from "./targets/index.ts";

interface Input {
  figmaFileKey: string;
  /** The email's top-level frame, as it appears in the Figma URL (`node-id=12-34`). */
  figmaNodeId: string;
  /** Template name on the send platform; a re-run with the same name updates it. */
  name: string;
  target: TargetName;
  /** Public URL the files in out/<name>/images/ are served from. */
  imageBaseUrl: string;
  /** Who approves the email before it is deployed (`slack:#channel`, `slack:@user`, or a handle). */
  reviewer: string;
  subject?: string;
  preheader?: string;
}

const ROOT = new URL(".", import.meta.url).pathname;
const TSX = `${ROOT}node_modules/.bin/tsx`;
const MAX_ATTEMPTS = 3;

const sh = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const script = (name: string, ...args: string[]): string => `${sh(TSX)} ${sh(`${ROOT}scripts/${name}`)} ${args.map(sh).join(" ")}`;

/** Fail the run with a journaled reason. */
async function fail(f: Ctx, reason: string): Promise<never> {
  await f.run(`echo ${sh(reason)} >&2; exit 1`);
  throw new Error(reason); // unreachable: the step above fails the run
}

function inputProblems(input: Partial<Input> | undefined): string[] {
  const need = ["figmaFileKey", "figmaNodeId", "name", "imageBaseUrl", "reviewer"] as const;
  const problems: string[] = need.filter((k) => typeof input?.[k] !== "string" || !input[k]!.trim()).map((k) => `input.${k} is required`);
  if (!isTarget(input?.target)) problems.push(`input.target must be one of ${Object.keys(TARGETS).join(", ")}`);
  if (input?.imageBaseUrl && !input.imageBaseUrl.startsWith("https://")) problems.push("input.imageBaseUrl must be an https:// URL");
  if (input?.name && !slug(input.name)) problems.push("input.name needs at least one letter or digit");
  return problems;
}

/** The model maps the non-library layers; its answer is checked and sent back with findings until it passes. */
async function mapWithModel(f: Ctx, layers: Layer[], design: Design): Promise<ModelMapping | { findings: string[] }> {
  const images = new Set(Object.values(design.images));
  let findings: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const answer = (await f.llm(mappingPrompt(layers, design, findings), { output: MAPPING_SCHEMA })) as ModelMapping;
    findings = mappingProblems(answer, layers, images);
    if (findings.length === 0) return answer;
  }
  return { findings };
}

export default flow<Input>("figma-to-email", async (f, input) => {
  const refused = inputProblems(input);
  if (refused.length) {
    await f.run(`echo ${sh(`Refused: ${refused.join("; ")}`)} >&2`);
    return f.done("declined");
  }
  const out = `${ROOT}out/${slug(input.name)}`;

  await f.run(script("preflight.ts", input.target));
  const design = JSON.parse(await f.run(script("fetch-design.ts", input.figmaFileKey, input.figmaNodeId, out), { timeout: "5m" })) as Design;
  const mapped = mapDesign(design);

  const unmatched = mapped.slots.filter((s) => s.blocks === null).map((s) => s.layer);
  let unmappable: ModelMapping["unmappable"] = [];
  const byLayer = new Map<string, Block[]>();
  if (unmatched.length) {
    const result = await mapWithModel(f, unmatched, design);
    if ("findings" in result) {
      return fail(f, `Could not map ${unmatched.length} non-library layer(s) to approved components after ${MAX_ATTEMPTS} attempts:\n- ${result.findings.join("\n- ")}`);
    }
    unmappable = result.unmappable;
    for (const b of result.blocks) byLayer.set(b.layerId, [...(byLayer.get(b.layerId) ?? []), b]);
  }

  const spec: EmailSpec = {
    name: input.name,
    subject: input.subject ?? mapped.meta.subject ?? "",
    preheader: input.preheader ?? mapped.meta.preheader ?? "",
    blocks: mapped.slots.flatMap((s) => s.blocks ?? byLayer.get(s.layer.id) ?? []),
  };
  const invalid = specProblems(spec, new Set(Object.values(design.images)));
  if (invalid.length) return fail(f, `The email does not satisfy the component library:\n- ${invalid.join("\n- ")}`);

  const rendered = JSON.parse(await f.run(script("render.tsx", out, input.target, input.imageBaseUrl, b64(spec)), { timeout: "2m" })) as { sha256: string; bytes: number; problems: string[] };
  if (rendered.problems.length) return fail(f, `The rendered email failed its checks:\n- ${rendered.problems.join("\n- ")}`);

  const byModel = spec.blocks.filter((b) => byLayer.has(b.layerId)).length;
  const images = Object.keys(design.images).length;
  const approved = await f.human([
    `Email "${input.name}" from Figma frame "${design.frameName}" is ready for ${input.target}.`,
    `Subject: ${spec.subject}${spec.preheader ? `\nPreheader: ${spec.preheader}` : ""}`,
    `${spec.blocks.length} blocks: ${spec.blocks.length - byModel} from library components, ${byModel} mapped by the model from non-library layers. ${Math.round(rendered.bytes / 1024)}KB HTML.`,
    ...(unmappable.length ? [`Left out (not expressible with approved components):\n${unmappable.map((u) => `- layer ${u.layerId}: ${u.reason}`).join("\n")}`] : []),
    `Preview: ${out}/email.html (plain text: email.txt, blocks: spec.json).`,
    ...(images ? [`Upload ${out}/images/ (${images} file(s)) to ${input.imageBaseUrl} before sending.`] : []),
    `Deploy it to ${input.target}?`,
  ].join("\n"), { to: input.reviewer });
  if (!approved) return f.done("declined");

  const receipt = JSON.parse(await f.run(script("deploy.ts", input.target, out, rendered.sha256), { timeout: "2m" })) as Receipt;
  await f.run(`echo ${sh(`${receipt.action} ${receipt.target} template ${receipt.id} "${input.name}"`)}`);
  f.done("success");
});
