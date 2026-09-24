// Send platforms the flow deploys to. Each one upserts a template by name, so a
// re-run replaces the template it created instead of adding a copy.
import { braze } from "./braze.ts";
import { sfmc } from "./sfmc.ts";

export interface Template {
  name: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface Receipt {
  target: TargetName;
  id: string;
  action: "created" | "updated";
}

export interface Target {
  /** The platform's merge tag for its own unsubscribe link. */
  unsubscribeUrl: string;
  /** Environment variables the target reads; the flow refuses to start without them. */
  env: readonly string[];
  upsert(template: Template, env: NodeJS.ProcessEnv): Promise<Receipt>;
}

export const TARGETS = { braze, sfmc } as const satisfies Record<string, Target>;
export type TargetName = keyof typeof TARGETS;
export const isTarget = (name: unknown): name is TargetName => typeof name === "string" && name in TARGETS;

/** A failed platform call, with the response body and without request credentials. */
export async function expectOk(res: Response, what: string): Promise<any> {
  const body = await res.text();
  if (!res.ok) throw new Error(`${what} failed: HTTP ${res.status} ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}
