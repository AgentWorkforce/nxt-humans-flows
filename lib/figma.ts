// Figma REST responses → the compact design the flow maps. Pure: no I/O.
//
// The email is one top-level frame. Each direct child is one layer of the
// email, top to bottom. A child that is an instance of a design-library
// component carries that component's name and properties; anything else
// (detached instances, loose text, groups) is described by its text, images
// and links so it can still be mapped.

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  characters?: string;
  children?: FigmaNode[];
  componentId?: string;
  componentProperties?: Record<string, { type: string; value: string | boolean }>;
  fills?: { type: string; imageRef?: string; visible?: boolean }[];
  style?: { hyperlink?: { type: string; url?: string } };
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
}

export interface FigmaNodesResponse {
  name: string;
  nodes: Record<string, {
    document: FigmaNode;
    components: Record<string, { name: string; componentSetId?: string }>;
    componentSets?: Record<string, { name: string }>;
  } | null>;
}

export interface Layer {
  id: string;
  name: string;
  type: string;
  /** Library component name (e.g. `Email/Hero`) when the layer is an instance. */
  component?: string;
  /** Component properties, keyed without Figma's `#id` suffix. */
  properties: Record<string, string | boolean>;
  texts: { name: string; text: string; link?: string }[];
  /** Image fills by layer name; `ref` is Figma's imageRef. */
  images: { name: string; ref: string }[];
}

export interface Design {
  fileKey: string;
  nodeId: string;
  fileName: string;
  frameName: string;
  layers: Layer[];
  /** Every image the layers reference: Figma imageRef → exported file name. */
  images: Record<string, string>;
}

const shown = (n: FigmaNode) => n.visible !== false;

function walk(node: FigmaNode, visit: (n: FigmaNode) => void): void {
  if (!shown(node)) return;
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function layer(node: FigmaNode, components: FigmaNodesResponse["nodes"][string] & object): Layer {
  const def = node.componentId ? components.components[node.componentId] : undefined;
  const set = def?.componentSetId ? components.componentSets?.[def.componentSetId] : undefined;
  const properties: Layer["properties"] = {};
  for (const [key, prop] of Object.entries(node.componentProperties ?? {})) {
    properties[key.replace(/#[^#]*$/, "")] = prop.value;
  }
  const texts: Layer["texts"] = [];
  const images: Layer["images"] = [];
  walk(node, (n) => {
    if (n.type === "TEXT" && n.characters?.trim()) {
      const link = n.style?.hyperlink?.type === "URL" ? n.style.hyperlink.url : undefined;
      texts.push({ name: n.name, text: n.characters.trim(), ...(link ? { link } : {}) });
    }
    for (const fill of n.fills ?? []) {
      if (fill.type === "IMAGE" && fill.imageRef && fill.visible !== false) images.push({ name: n.name, ref: fill.imageRef });
    }
  });
  const component = node.type === "INSTANCE" ? (set?.name ?? def?.name) : undefined;
  return { id: node.id, name: node.name, type: node.type, ...(component ? { component } : {}), properties, texts, images };
}

export function normalize(res: FigmaNodesResponse, fileKey: string, nodeId: string): Omit<Design, "images"> {
  const entry = res.nodes[nodeId];
  if (!entry) throw new Error(`Figma node ${nodeId} not found in file ${fileKey}`);
  const frame = entry.document;
  if (!frame.children?.length) throw new Error(`Figma node ${nodeId} ("${frame.name}") has no layers; select the email's top-level frame`);
  const children = frame.children.filter(shown)
    .map((node, index) => ({ node, index }))
    .sort((a, b) => (a.node.absoluteBoundingBox?.y ?? a.index) - (b.node.absoluteBoundingBox?.y ?? b.index) || a.index - b.index)
    .map(({ node }) => node);
  return { fileKey, nodeId, fileName: res.name, frameName: frame.name, layers: children.map((c) => layer(c, entry)) };
}

/** Figma node ids in URLs use `-` (`12-34`); the API uses `:` (`12:34`). */
export const apiNodeId = (id: string): string => id.replaceAll("-", ":");
