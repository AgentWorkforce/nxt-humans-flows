import assert from "node:assert/strict";
import { test } from "node:test";
import { normalize } from "../lib/figma.ts";
import { mapDesign, mappingProblems, type ModelMapping } from "../lib/map.ts";
import { specProblems, type Block, type EmailSpec } from "../lib/spec.ts";
import { design, nodes } from "./fixture.ts";

test("normalize orders visible layers top to bottom and resolves variant sets", () => {
  const d = normalize(nodes, "FILE", "12:34");
  assert.deepEqual(d.layers.map((l) => l.name), ["Meta", "Header", "Hero", "Feature — boards", "Divider", "P.S.", "Footer"]);
  assert.equal(d.layers[2]!.component, "Email/Hero");
  assert.equal(d.layers[2]!.properties.Headline, "Work moves faster together");
  const feature = d.layers[3]!;
  assert.equal(feature.component, undefined);
  assert.deepEqual(feature.texts.map((t) => t.text), ["Shared boards", "Plan the quarter on one board your whole team can edit, comment on and follow.", "Try shared boards"]);
  assert.equal(feature.texts[2]!.link, "https://nxthumans.example.com/boards");
});

test("library instances map by rule; other layers are left for the model", () => {
  const m = mapDesign(design());
  assert.deepEqual(m.meta, { subject: "Meet the fall lineup", preheader: "Three new ways to work together, live today." });
  assert.deepEqual(m.slots.map((s) => s.blocks?.[0]?.component ?? null), ["Header", "Hero", null, "Divider", null, "Footer"]);
  assert.deepEqual(m.slots[0]!.blocks![0]!.props, { logo: "logo.png", logoAlt: "NXT Humans", href: "https://nxthumans.example.com" });
  assert.deepEqual(m.slots[1]!.blocks![0]!.props, {
    image: "hero.png", imageAlt: "Three teammates planning around a whiteboard", headline: "Work moves faster together",
    body: "Shared boards, live handoffs and a calmer inbox — all in this fall's release.", ctaLabel: "See what's new", ctaUrl: "https://nxthumans.example.com/fall",
  });
});

test("a Show <prop> boolean set to false drops that prop", () => {
  const d = design();
  d.layers[2]!.properties["Show Body"] = false;
  assert.equal(mapDesign(d).slots[1]!.blocks![0]!.props.body, undefined);
});

test("the model's mapping must cover every layer with valid approved blocks", () => {
  const d = design();
  const unmatched = mapDesign(d).slots.filter((s) => !s.blocks).map((s) => s.layer);
  const images = new Set(["logo.png", "hero.png"]);
  const good: ModelMapping = {
    blocks: [
      { layerId: "12:40", component: "Heading", props: { text: "Shared boards" } },
      { layerId: "12:40", component: "Button", props: { label: "Try shared boards", href: "https://nxthumans.example.com/boards" } },
    ],
    unmappable: [{ layerId: "12:46", reason: "test" }],
  };
  assert.deepEqual(mappingProblems(good, unmatched, images), []);
  const bad: ModelMapping = {
    blocks: [
      { layerId: "12:40", component: "Carousel" as never, props: {} },
      { layerId: "12:40", component: "Button", props: { label: "Go", href: "http://insecure.example.com", size: "xl" } },
      { layerId: "99:99", component: "Divider", props: {} },
    ],
    unmappable: [],
  };
  const problems = mappingProblems(bad, unmatched, images);
  assert.ok(problems.some((p) => p.includes('"Carousel" is not an approved component')));
  assert.ok(problems.some((p) => p.includes('unknown prop "size"')));
  assert.ok(problems.some((p) => p.includes("must be an https:// URL")));
  assert.ok(problems.some((p) => p.includes('layerId "99:99" is not one of the layers given')));
  assert.ok(problems.some((p) => p.includes('layer "12:46" is missing')));
});

test("a spec needs a subject and exactly one Footer, last", () => {
  const footer: Block = { component: "Footer", props: { company: "C", address: "A" }, layerId: "f" };
  const text: Block = { component: "Text", props: { text: "hi" }, layerId: "t" };
  const spec = (blocks: EmailSpec["blocks"], subject = "S"): EmailSpec => ({ name: "n", subject, preheader: "", blocks });
  assert.deepEqual(specProblems(spec([text, footer]), new Set()), []);
  assert.deepEqual(specProblems(spec([footer, text]), new Set()), ["the Footer must be the last block"]);
  assert.deepEqual(specProblems(spec([text]), new Set()), ["the email needs exactly one Footer"]);
  assert.match(specProblems(spec([text, footer], " "), new Set())[0]!, /subject is empty/);
  assert.match(specProblems(spec([{ component: "Hero", props: { image: "x.png", imageAlt: "a", headline: "h", ctaLabel: "Go" }, layerId: "h" }, footer]), new Set(["x.png"]))[0]!, /ctaLabel and ctaUrl go together/);
});
