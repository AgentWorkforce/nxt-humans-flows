// Step: render the spec through the approved components, check the result, write it.
//   render.tsx <outDir> <target> <imageBaseUrl> <spec as base64 JSON>
// Writes spec.json, email.html and email.txt; prints { sha256, bytes, problems }.
import { render } from "@react-email/render";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Email } from "../library/components.tsx";
import { htmlProblems } from "../lib/checks.ts";
import { emit, main } from "../lib/io.ts";
import type { EmailSpec } from "../lib/spec.ts";
import { TARGETS, isTarget } from "../targets/index.ts";

await main(async () => {
  const [outDir, target, imageBaseUrl, specB64] = process.argv.slice(2);
  if (!outDir || !isTarget(target) || imageBaseUrl === undefined || !specB64) throw new Error("usage: render.tsx <outDir> <braze|sfmc> <imageBaseUrl> <specB64>");
  const spec = JSON.parse(Buffer.from(specB64, "base64").toString("utf8")) as EmailSpec;
  const { unsubscribeUrl } = TARGETS[target];
  const src = (file: string) => new URL(file, imageBaseUrl.endsWith("/") ? imageBaseUrl : `${imageBaseUrl}/`).href;
  const element = <Email spec={spec} src={src} unsubscribeUrl={unsubscribeUrl} />;
  const html = await render(element);
  const text = await render(element, { plainText: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "spec.json"), JSON.stringify(spec, null, 2));
  await writeFile(join(outDir, "email.html"), html);
  await writeFile(join(outDir, "email.txt"), text);
  emit({ sha256: createHash("sha256").update(html).digest("hex"), bytes: Buffer.byteLength(html), problems: htmlProblems(html, unsubscribeUrl) });
});
