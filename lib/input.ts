// What a run is started with, and why a run refuses to start.
import { TARGETS, isTarget, type TargetName } from "../targets/index.ts";

export interface Input {
  figmaFileKey: string;
  /** The email's top-level frame, as it appears in the Figma URL (`node-id=12-34`). */
  figmaNodeId: string;
  /** Template name on the send platform; a re-run with the same name updates it. */
  name: string;
  target: TargetName;
  /** Public URL the files in out/<name>/images/ are served from. */
  imageBaseUrl: string;
  /** Who approves the email before it is deployed (`slack:#channel`, `slack:@user`, or a handle). */
  reviewer: string;
  subject?: string;
  preheader?: string;
}

export const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function inputProblems(input: Partial<Input> | undefined): string[] {
  const need = ["figmaFileKey", "figmaNodeId", "name", "imageBaseUrl", "reviewer"] as const;
  const problems: string[] = need.filter((k) => typeof input?.[k] !== "string" || !input[k]!.trim()).map((k) => `input.${k} is required`);
  if (!isTarget(input?.target)) problems.push(`input.target must be one of ${Object.keys(TARGETS).join(", ")}`);
  if (input?.imageBaseUrl && !input.imageBaseUrl.startsWith("https://")) problems.push("input.imageBaseUrl must be an https:// URL");
  if (input?.name && !slug(input.name)) problems.push("input.name needs at least one letter or digit");
  return problems;
}
