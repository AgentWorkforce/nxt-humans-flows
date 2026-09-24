// Step: upsert the approved email as a template on the send platform.
//   deploy.ts <target> <outDir> <sha256 of the approved email.html>
// Refuses when email.html is not the one the reviewer approved.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { emit, main, requireEnv } from "../lib/io.ts";
import type { EmailSpec } from "../lib/spec.ts";
import { TARGETS, isTarget } from "../targets/index.ts";

await main(async () => {
  const [target, outDir, approved] = process.argv.slice(2);
  if (!isTarget(target) || !outDir || !approved) throw new Error("usage: deploy.ts <braze|sfmc> <outDir> <sha256>");
  const html = await readFile(join(outDir, "email.html"), "utf8");
  const sha = createHash("sha256").update(html).digest("hex");
  if (sha !== approved) throw new Error(`${outDir}/email.html changed after approval (sha256 ${sha}, approved ${approved}); run the flow again`);
  const spec = JSON.parse(await readFile(join(outDir, "spec.json"), "utf8")) as EmailSpec;
  const text = await readFile(join(outDir, "email.txt"), "utf8");
  const env = requireEnv(TARGETS[target].env);
  emit(await TARGETS[target].upsert({ name: spec.name, subject: spec.subject, preheader: spec.preheader, html, text }, env));
});
