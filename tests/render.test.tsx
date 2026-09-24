import assert from "node:assert/strict";
import { test } from "node:test";
import { render } from "@react-email/render";
import { Email } from "../library/components.tsx";
import { htmlProblems } from "../lib/checks.ts";
import { mapDesign } from "../lib/map.ts";
import type { EmailSpec } from "../lib/spec.ts";
import { TARGETS } from "../targets/index.ts";
import { design } from "./fixture.ts";

const spec: EmailSpec = {
  name: "Fall", subject: "Meet the fall lineup", preheader: "Three new ways",
  blocks: mapDesign(design()).slots.flatMap((s) => s.blocks ?? []),
};
const src = (f: string) => `https://cdn.example.com/fall/${f}`;

for (const [name, target] of Object.entries(TARGETS)) {
  test(`renders the library blocks with ${name}'s unsubscribe tag and passes the checks`, async () => {
    const html = await render(<Email spec={spec} src={src} unsubscribeUrl={target.unsubscribeUrl} />);
    assert.deepEqual(htmlProblems(html, target.unsubscribeUrl), []);
    assert.ok(html.includes("Work moves faster together"));
    assert.ok(html.includes('src="https://cdn.example.com/fall/hero.png"'));
    assert.ok(html.includes(`href="${target.unsubscribeUrl}"`));
  });
}

test("checks catch missing alt text, non-https links and a missing unsubscribe", () => {
  const html = '<a href="http://x.example.com">x</a><img src="https://cdn/x.png">';
  assert.deepEqual(htmlProblems(html, "%%unsub_center_url%%"), [
    'image without alt text: <img src="https://cdn/x.png">',
    "link is not https or a merge tag: http://x.example.com",
    "the unsubscribe link (%%unsub_center_url%%) is missing",
  ]);
});
