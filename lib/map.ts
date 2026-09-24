// Design → blocks. Library instances map by rule; every other layer is left
// for the model, which may only choose among the approved components.
import { COMPONENT_NAMES, META_COMPONENT, REGISTRY, componentForFigma, propDefs, type ComponentName } from "../library/registry.ts";
import type { Design, Layer } from "./figma.ts";
import { blockProblems, type Block } from "./spec.ts";

export interface Mapped {
  /** One entry per layer, in email order: its blocks, or null when the model must map it. */
  slots: { layer: Layer; blocks: Block[] | null }[];
  meta: { subject?: string; preheader?: string };
}

const text = (v: string | boolean | undefined): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** A library layer's props, read from its component properties, then its named text/image layers. */
export function libraryBlock(layer: Layer, component: ComponentName, design: Design): Block {
  const props: Record<string, string> = {};
  for (const [key, def] of Object.entries(propDefs(component))) {
    // Library convention: a boolean `Show <prop>` set to false removes that prop.
    if (layer.properties[`Show ${def.figma}`] === false) continue;
    let value: string | undefined;
    if (def.kind === "image") {
      const images = Object.values(propDefs(component)).filter((d) => d.kind === "image");
      const fill = layer.images.find((i) => i.name === def.figma) ?? (images.length === 1 ? layer.images[0] : undefined);
      value = fill ? design.images[fill.ref] : undefined;
    } else {
      value = text(layer.properties[def.figma]) ?? layer.texts.find((t) => t.name === def.figma)?.text;
      if (def.kind === "enum") value = value?.toLowerCase();
      // A URL may live as a hyperlink on the text it belongs to rather than as a property.
      if (def.kind === "url" && !value) value = layer.texts.find((t) => t.link)?.link;
    }
    if (value !== undefined) props[key] = value;
  }
  return { component, props, layerId: layer.id };
}

export function mapDesign(design: Design): Mapped {
  const meta: Mapped["meta"] = {};
  const slots: Mapped["slots"] = [];
  for (const layer of design.layers) {
    if (layer.component === META_COMPONENT) {
      const subject = text(layer.properties.Subject) ?? layer.texts.find((t) => t.name === "Subject")?.text;
      const preheader = text(layer.properties.Preheader) ?? layer.texts.find((t) => t.name === "Preheader")?.text;
      Object.assign(meta, subject ? { subject } : {}, preheader ? { preheader } : {});
      continue;
    }
    const component = layer.component ? componentForFigma(layer.component) : undefined;
    slots.push({ layer, blocks: component ? [libraryBlock(layer, component, design)] : null });
  }
  return { slots, meta };
}

// ---- the model's half: layers that are not library instances ----

export interface ModelMapping {
  blocks: Block[];
  unmappable: { layerId: string; reason: string }[];
}

export function mappingPrompt(layers: Layer[], design: Design, findings: readonly string[]): string {
  const catalog = COMPONENT_NAMES.map((name) => {
    const props = Object.entries(propDefs(name)).map(([k, d]) =>
      `    ${k}${d.required ? "" : "?"}: ${d.kind}${d.values ? ` (${d.values.join(" | ")})` : ""} — ${d.description}`);
    return `- ${name}: ${REGISTRY[name].description}\n${props.join("\n") || "    (no props)"}`;
  }).join("\n");
  const described = layers.map((l) => ({
    layerId: l.id, name: l.name, type: l.type, ...(l.component ? { detachedFrom: l.component } : {}),
    texts: l.texts, images: l.images.map((i) => ({ layer: i.name, file: design.images[i.ref] })),
  }));
  return [
    "You map layers of a Figma email design onto an approved set of React Email components.",
    "These layers are not instances of the design library, so they must be expressed with the approved components below. Use no other components and no other props.",
    "",
    "Approved components:",
    catalog,
    "",
    "Rules:",
    "- One layer may become several blocks (for example a heading, a paragraph and a button). List blocks in reading order and give each the layerId it came from.",
    "- Copy text verbatim from the layer. Do not invent copy, links or alt text you cannot infer from the layer; image alt text may describe the layer's name and nearby copy.",
    "- image props take the `file` value of one of the layer's images. url props take an https:// URL present in the layer.",
    "- A layer that cannot be expressed faithfully goes in `unmappable` with a one-sentence reason instead.",
    "- Every layerId below must appear in blocks or in unmappable.",
    "",
    "Layers:",
    JSON.stringify(described, null, 2),
    ...(findings.length ? ["", "Your previous answer was rejected. Fix every one of these problems:", ...findings.map((p) => `- ${p}`)] : []),
    "",
    "Reply with JSON only: {\"blocks\": [{\"layerId\", \"component\", \"props\"}], \"unmappable\": [{\"layerId\", \"reason\"}]}.",
  ].join("\n");
}

export const MAPPING_SCHEMA = {
  type: "object",
  required: ["blocks", "unmappable"],
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        required: ["layerId", "component", "props"],
        properties: {
          layerId: { type: "string" },
          component: { type: "string", enum: COMPONENT_NAMES },
          props: { type: "object", additionalProperties: { type: "string" } },
        },
      },
    },
    unmappable: {
      type: "array",
      items: { type: "object", required: ["layerId", "reason"], properties: { layerId: { type: "string" }, reason: { type: "string" } } },
    },
  },
} as const;

/** Problems with the model's mapping of `layers`. Empty means accepted. */
export function mappingProblems(mapping: ModelMapping, layers: Layer[], images: ReadonlySet<string>): string[] {
  const ids = new Set(layers.map((l) => l.id));
  const covered = new Set([...mapping.blocks.map((b) => b.layerId), ...mapping.unmappable.map((u) => u.layerId)]);
  const problems = mapping.blocks.flatMap((b) => blockProblems(b, images));
  for (const id of covered) if (!ids.has(id)) problems.push(`layerId "${id}" is not one of the layers given`);
  for (const id of ids) if (!covered.has(id)) problems.push(`layer "${id}" is missing: map it or list it as unmappable`);
  return problems;
}
