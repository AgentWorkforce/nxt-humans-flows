// Step: refuse before any work when a credential the run needs is missing.
// Steps run in the relayflowd daemon, so this checks the environment they will
// actually see — not the shell that started the run.
//   preflight.ts <target>
import { main, requireEnv } from "../lib/io.ts";
import { TARGETS, isTarget } from "../targets/index.ts";

await main(async () => {
  const target = process.argv[2];
  if (!isTarget(target)) throw new Error("usage: preflight.ts <braze|sfmc>");
  requireEnv(["FIGMA_TOKEN", ...TARGETS[target].env]);
});
