// Figma → React Email → Braze or Salesforce Marketing Cloud.
//
//   flows run figma-to-email.flow.ts --local-agent --input \
//     '{"figmaFileKey":"<key>","figmaNodeId":"12-34","name":"2026-10 Fall launch","target":"braze","imageBaseUrl":"https://cdn.example.com/email/fall","reviewer":"<you>"}'
import { flow } from "@relayflows/surface";
import { composeEmail } from "./lib/compose.ts";
import { evals } from "./lib/evals.ts";
import { inputProblems, type Input } from "./lib/input.ts";
import "./lib/next-surface.ts";
import { reviewQuestion } from "./lib/review.ts";
import { failOn, sh, steps } from "./lib/steps.ts";

export default flow<Input>("figma-to-email", async (f, input) => {
  const refused = inputProblems(input);
  if (refused.length) {
    await f.run(`echo ${sh(`Refused: ${refused.join("; ")}`)} >&2`);
    return f.done("declined");
  }
  const step = steps(f, input);

  // 1. Refuse up front if a Figma or send-platform credential is missing.
  await step.checkCredentials();

  // 2. Fetch the email frame from Figma and download its images.
  const design = await step.fetchDesign();

  // 3. Map it to approved React Email components: library instances by rule, everything else by the model.
  const email = await composeEmail(f, design, input);

  // 4. Render it, then check size, alt text, links and the unsubscribe link.
  const html = await step.render(email.spec);
  await failOn(f, "The rendered email failed its checks", html.problems);

  // 5. Judges score the rendered email, one rubric each.
  const judged = {
    copyMatchesFigma: await f.judge("copy-matches-figma", evals.copyMatchesFigma(design, email)),
    onBrand: await f.judge("on-brand", evals.onBrand(email)),
    accessible: await f.judge("accessible", evals.accessible(email)),
  };

  // 6. A classifier decides whether a person needs to see it before it ships.
  const route = await f.classify("route", {
    input: { judged, mappedByModel: email.byModel, leftOut: email.leftOut },
    labels: {
      "auto-deploy": "Every judge passed with no findings, the model mapped nothing, and nothing was left out.",
      "alert-human": "A judge failed or raised a finding, the model mapped any content, or any layer was left out.",
    },
  });

  // 7. Only when the classifier asks: a person reviews and approves.
  if (route.label === "alert-human") {
    const approved = await f.human(reviewQuestion({ input, design, email, html, judged, route, out: step.out }), { to: input.reviewer });
    if (!approved) return f.done("declined");
  }

  // 8. Create the template on the send platform, or update the one with the same name.
  const receipt = await step.deploy(html);
  await step.say(`${receipt.action} ${receipt.target} template ${receipt.id} "${input.name}"`);
  f.done("success");
});
