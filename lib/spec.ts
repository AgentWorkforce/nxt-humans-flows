// The email spec: an ordered list of approved components with their props.
// It is the contract between mapping (Figma → spec) and rendering (spec → HTML).
import { COMPONENT_NAMES, propDefs, type ComponentName } from "../library/registry.ts";

export interface Block {
  component: ComponentName;
  props: Record<string, string>;
  /** The Figma layer this block came from, for review and traceability. */
  layerId: string;
}

export interface EmailSpec {
  name: string;
  subject: string;
  preheader: string;
  blocks: Block[];
}

const MERGE_TAG = /^(\{\{.+\}\}|%%.+%%)$/;

/** Problems with one block, as sentences a model or a reviewer can act on. Empty means valid. */
export function blockProblems(block: { component: string; props: Record<string, unknown>; layerId?: string }, images: ReadonlySet<string>): string[] {
  const at = `${block.component} (layer ${block.layerId ?? "?"})`;
  if (!COMPONENT_NAMES.includes(block.component as ComponentName)) {
    return [`${at}: "${block.component}" is not an approved component; use one of ${COMPONENT_NAMES.join(", ")}`];
  }
  const defs = propDefs(block.component as ComponentName);
  const problems: string[] = [];
  for (const key of Object.keys(block.props)) {
    if (!(key in defs)) problems.push(`${at}: unknown prop "${key}"; allowed: ${Object.keys(defs).join(", ") || "none"}`);
  }
  for (const [key, def] of Object.entries(defs)) {
    const value = block.props[key];
    if (value === undefined || value === "") {
      if (def.required) problems.push(`${at}: missing required prop "${key}" (${def.description})`);
      continue;
    }
    if (typeof value !== "string") { problems.push(`${at}: prop "${key}" must be a string`); continue; }
    if (def.kind === "url" && !value.startsWith("https://") && !MERGE_TAG.test(value)) {
      problems.push(`${at}: prop "${key}" must be an https:// URL or an ESP merge tag, got "${value}"`);
    }
    if (def.kind === "enum" && !def.values?.includes(value)) {
      problems.push(`${at}: prop "${key}" must be one of ${def.values?.join(", ")}, got "${value}"`);
    }
    if (def.kind === "image" && !images.has(value)) {
      problems.push(`${at}: prop "${key}" names image "${value}", which is not an exported layer image`);
    }
  }
  if (block.component === "Hero" && Boolean(block.props.ctaLabel) !== Boolean(block.props.ctaUrl)) {
    problems.push(`${at}: ctaLabel and ctaUrl go together; set both or neither`);
  }
  return problems;
}

export function specProblems(spec: EmailSpec, images: ReadonlySet<string>): string[] {
  const problems = spec.blocks.flatMap((b) => blockProblems(b, images));
  if (!spec.subject.trim()) problems.push("subject is empty: set it on the Email/Meta layer or pass input.subject");
  if (spec.blocks.filter((b) => b.component === "Footer").length !== 1) problems.push("the email needs exactly one Footer");
  else if (spec.blocks.at(-1)?.component !== "Footer") problems.push("the Footer must be the last block");
  return problems;
}
