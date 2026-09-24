// The flow's system steps. Each one is a script under scripts/, run as a
// journaled `f.run` step, so a resumed run never repeats a finished one.
import type { Ctx } from "@relayflows/surface";
import type { Receipt } from "../targets/index.ts";
import type { Design } from "./figma.ts";
import { slug, type Input } from "./input.ts";
import type { EmailSpec } from "./spec.ts";

export interface Rendered { sha256: string; bytes: number; problems: string[] }

const ROOT = new URL("..", import.meta.url).pathname;
const TSX = `${ROOT}node_modules/.bin/tsx`;

/** User text never reaches a shell unquoted. */
export const sh = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const script = (name: string, ...args: string[]): string => `${sh(TSX)} ${sh(`${ROOT}scripts/${name}`)} ${args.map(sh).join(" ")}`;

export function steps(f: Ctx, input: Input) {
  const out = `${ROOT}out/${slug(input.name)}`;
  const json = async <T>(command: string, timeout: string): Promise<T> => JSON.parse(await f.run(command, { timeout })) as T;
  return {
    /** Where this email's design, images, spec and HTML are written. */
    out,
    checkCredentials: () => f.run(script("preflight.ts", input.target)),
    fetchDesign: () => json<Design>(script("fetch-design.ts", input.figmaFileKey, input.figmaNodeId, out), "5m"),
    render: (spec: EmailSpec) => json<Rendered>(script("render.tsx", out, input.target, input.imageBaseUrl, b64(spec)), "2m"),
    deploy: (approved: Rendered) => json<Receipt>(script("deploy.ts", input.target, out, approved.sha256), "2m"),
    say: (line: string) => f.run(`echo ${sh(line)}`),
  };
}

/** Fail the run with a journaled reason when there are problems. */
export async function failOn(f: Ctx, title: string, problems: readonly string[]): Promise<void> {
  if (problems.length === 0) return;
  const reason = `${title}:\n- ${problems.join("\n- ")}`;
  await f.run(`echo ${sh(reason)} >&2; exit 1`);
  throw new Error(reason); // unreachable: the step above fails the run
}
