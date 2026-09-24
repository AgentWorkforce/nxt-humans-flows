// Figma → React Email → Braze or Salesforce Marketing Cloud.
//
//   flows run figma-to-email.flow.ts --local-agent --input \
//     '{"figmaFileKey":"<key>","figmaNodeId":"12-34","name":"2026-10 Fall launch","target":"braze","imageBaseUrl":"https://cdn.example.com/email/fall","reviewer":"<you>"}'
import { flow } from "@relayflows/surface";
import { composeEmail } from "./lib/compose.ts";
import { inputProblems, type Input } from "./lib/input.ts";
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

  // 5. A person approves the email before it goes anywhere.
  const approved = await f.human(reviewQuestion(input, design, email, html, step.out), { to: input.reviewer });
  if (!approved) return f.done("declined");

  // 6. Create the template on the send platform, or update the one with the same name.
  const receipt = await step.deploy(html);
  await step.say(`${receipt.action} ${receipt.target} template ${receipt.id} "${input.name}"`);
  f.done("success");
});
