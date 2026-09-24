// Shared by the scripts the flow runs as journaled steps.

/** The flow reads a step's stdout from the journal, which keeps its last 64KB. */
const STDOUT_LIMIT = 60 * 1024;

export function emit(value: unknown): void {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > STDOUT_LIMIT) throw new Error(`result is ${Buffer.byteLength(json)} bytes; the journal keeps ${STDOUT_LIMIT}`);
  process.stdout.write(json + "\n");
}

export function requireEnv(names: readonly string[]): NodeJS.ProcessEnv {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new Error(`missing environment: ${missing.join(", ")}`);
  return process.env;
}

export async function main(run: () => Promise<void>): Promise<void> {
  try { await run(); } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
