// What each judge is shown and the rubric it scores against.
import type { Composed } from "./compose.ts";
import type { Design } from "./figma.ts";

const copy = (email: Composed) => email.spec.blocks.map((b) => ({ component: b.component, ...b.props }));

export const evals = {
  /** Every word came from the design: nothing invented, reworded or dropped. */
  copyMatchesFigma: (design: Design, email: Composed) => ({
    input: { figma: design.layers.map((l) => ({ layer: l.name, texts: l.texts.map((t) => t.text), properties: l.properties })), email: copy(email) },
    rubric: "Every piece of copy in `email` appears verbatim in `figma`, and every visible piece of copy in `figma` appears in `email` (the subject and preheader excepted). Alt text may be written fresh but must describe the layer it belongs to. Fail on any invented, reworded or missing copy.",
  }),
  /** The copy reads like the brand and makes no claims legal would stop. */
  onBrand: (email: Composed) => ({
    input: { subject: email.spec.subject, preheader: email.spec.preheader, email: copy(email) },
    rubric: "The copy is clear, warm and plain-spoken. It makes no absolute or unverifiable claims (\"best\", \"guaranteed\", \"#1\"), no pricing or discount promises, and no health, legal or financial advice. The subject line is under 60 characters and is not clickbait.",
  }),
  /** Readable without images and with a screen reader. */
  accessible: (email: Composed) => ({
    input: { email: copy(email) },
    rubric: "Every image has alt text that says what the image shows or does, not \"image\" or a file name. Every button and link label says where it goes (no bare \"click here\"). The email still makes sense with every image turned off.",
  }),
};
