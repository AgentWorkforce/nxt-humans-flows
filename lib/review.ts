// What the reviewer is asked before anything is deployed.
import type { Composed } from "./compose.ts";
import type { Design } from "./figma.ts";
import type { Input } from "./input.ts";
import type { Rendered } from "./steps.ts";

export function reviewQuestion(input: Input, design: Design, email: Composed, html: Rendered, out: string): string {
  const { spec, byModel, leftOut } = email;
  const images = Object.keys(design.images).length;
  return [
    `Email "${input.name}" from Figma frame "${design.frameName}" is ready for ${input.target}.`,
    `Subject: ${spec.subject}${spec.preheader ? `\nPreheader: ${spec.preheader}` : ""}`,
    `${spec.blocks.length} blocks: ${spec.blocks.length - byModel} from library components, ${byModel} mapped by the model from non-library layers. ${Math.round(html.bytes / 1024)}KB HTML.`,
    ...(leftOut.length ? [`Left out (not expressible with approved components):\n${leftOut.map((u) => `- layer ${u.layerId}: ${u.reason}`).join("\n")}`] : []),
    `Preview: ${out}/email.html (plain text: email.txt, blocks: spec.json).`,
    ...(images ? [`Upload ${out}/images/ (${images} file(s)) to ${input.imageBaseUrl} before sending.`] : []),
    `Deploy it to ${input.target}?`,
  ].join("\n");
}
