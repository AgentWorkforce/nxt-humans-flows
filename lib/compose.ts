// Design → email spec. Library instances map by rule; the model maps every
// other layer onto approved components, and its answer is checked and sent back
// with findings until it passes.
import type { Ctx } from "@relayflows/surface";
import type { Design, Layer } from "./figma.ts";
import type { Input } from "./input.ts";
import { mapDesign, mappingProblems, mappingPrompt, MAPPING_SCHEMA, type ModelMapping } from "./map.ts";
import { specProblems, type Block, type EmailSpec } from "./spec.ts";
import { failOn } from "./steps.ts";

const MAX_ATTEMPTS = 3;

export interface Composed {
  spec: EmailSpec;
  /** How many blocks came from the model rather than a library component. */
  byModel: number;
  /** Layers the model could not express with approved components; left out of the email. */
  leftOut: ModelMapping["unmappable"];
}

export async function composeEmail(f: Ctx, design: Design, input: Input): Promise<Composed> {
  const mapped = mapDesign(design);
  const unmatched = mapped.slots.filter((s) => s.blocks === null).map((s) => s.layer);
  const model = unmatched.length ? await mapWithModel(f, unmatched, design) : { blocks: [], unmappable: [] };

  const fromModel = new Map<string, Block[]>();
  for (const b of model.blocks) fromModel.set(b.layerId, [...(fromModel.get(b.layerId) ?? []), b]);
  const spec: EmailSpec = {
    name: input.name,
    subject: input.subject ?? mapped.meta.subject ?? "",
    preheader: input.preheader ?? mapped.meta.preheader ?? "",
    blocks: mapped.slots.flatMap((s) => s.blocks ?? fromModel.get(s.layer.id) ?? []),
  };
  await failOn(f, "The email does not satisfy the component library", specProblems(spec, new Set(Object.values(design.images))));
  return { spec, byModel: model.blocks.length, leftOut: model.unmappable };
}

async function mapWithModel(f: Ctx, layers: Layer[], design: Design): Promise<ModelMapping> {
  const images = new Set(Object.values(design.images));
  let findings: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const answer = (await f.llm(mappingPrompt(layers, design, findings), { output: MAPPING_SCHEMA })) as ModelMapping;
    findings = mappingProblems(answer, layers, images);
    if (findings.length === 0) return answer;
  }
  await failOn(f, `Could not map ${layers.length} non-library layer(s) to approved components after ${MAX_ATTEMPTS} attempts`, findings);
  throw new Error("unreachable");
}
