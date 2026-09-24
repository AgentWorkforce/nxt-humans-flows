// What the reviewer is asked when the classifier routes the email to a person.
import type { Composed } from "./compose.ts";
import type { Design } from "./figma.ts";
import type { Input } from "./input.ts";
import type { Classification, Verdict } from "./next-surface.ts";
import type { Rendered } from "./steps.ts";

export interface Review {
  input: Input;
  design: Design;
  email: Composed;
  html: Rendered;
  judged: Record<string, Verdict>;
  route: Classification<string>;
  out: string;
}

export function reviewQuestion({ input, design, email, html, judged, route, out }: Review): string {
  const { spec, byModel, leftOut } = email;
  const images = Object.keys(design.images).length;
  const verdicts = Object.entries(judged).map(([name, v]) =>
    `- ${name}: ${v.pass ? "pass" : "FAIL"} (${v.score.toFixed(2)})${v.findings.map((x) => `\n    · ${x}`).join("")}`);
  return [
    `Email "${input.name}" from Figma frame "${design.frameName}" needs your review before it goes to ${input.target}.`,
    `Why: ${route.reason}`,
    `Subject: ${spec.subject}${spec.preheader ? `\nPreheader: ${spec.preheader}` : ""}`,
    `${spec.blocks.length} blocks: ${spec.blocks.length - byModel} from library components, ${byModel} mapped by the model from non-library layers. ${Math.round(html.bytes / 1024)}KB HTML.`,
    `Judges:\n${verdicts.join("\n")}`,
    ...(leftOut.length ? [`Left out (not expressible with approved components):\n${leftOut.map((u) => `- layer ${u.layerId}: ${u.reason}`).join("\n")}`] : []),
    `Preview: ${out}/email.html (plain text: email.txt, blocks: spec.json).`,
    ...(images ? [`Upload ${out}/images/ (${images} file(s)) to ${input.imageBaseUrl} before sending.`] : []),
    `Deploy it to ${input.target}?`,
  ].join("\n");
}
