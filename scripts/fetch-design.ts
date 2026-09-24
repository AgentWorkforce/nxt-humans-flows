// Step: fetch the email frame from Figma, download its images, write design.json.
//   fetch-design.ts <fileKey> <nodeId> <outDir>
// Env: FIGMA_TOKEN (personal access token or OAuth token with file_content:read);
// FIGMA_API_URL overrides https://api.figma.com.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { apiNodeId, normalize, type Design, type FigmaNodesResponse } from "../lib/figma.ts";
import { emit, main, requireEnv } from "../lib/io.ts";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

await main(async () => {
  const [fileKey, rawNodeId, outDir] = process.argv.slice(2);
  if (!fileKey || !rawNodeId || !outDir) throw new Error("usage: fetch-design.ts <fileKey> <nodeId> <outDir>");
  const env = requireEnv(["FIGMA_TOKEN"]);
  const api = (env.FIGMA_API_URL ?? "https://api.figma.com").replace(/\/$/, "");
  const get = async (path: string): Promise<any> => {
    const res = await fetch(`${api}${path}`, { headers: { "X-Figma-Token": env.FIGMA_TOKEN! } });
    if (!res.ok) throw new Error(`Figma GET ${path} failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };

  const nodeId = apiNodeId(rawNodeId);
  const res = (await get(`/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}`)) as FigmaNodesResponse;
  const design = normalize(res, fileKey, nodeId);

  // Image fills are exported at their original resolution and named by content
  // hash, so the same image keeps the same URL across runs.
  const refs = [...new Set(design.layers.flatMap((l) => l.images.map((i) => i.ref)))];
  const images: Design["images"] = {};
  if (refs.length) {
    const fills: Record<string, string> = (await get(`/v1/files/${encodeURIComponent(fileKey)}/images`)).meta?.images ?? {};
    await mkdir(join(outDir, "images"), { recursive: true });
    for (const ref of refs) {
      if (!fills[ref]) throw new Error(`Figma returned no download URL for image ${ref}`);
      const img = await fetch(fills[ref]);
      if (!img.ok) throw new Error(`image ${ref} download failed: HTTP ${img.status}`);
      const bytes = Buffer.from(await img.arrayBuffer());
      const ext = EXT[img.headers.get("content-type")?.split(";")[0] ?? ""] ?? "png";
      const file = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
      await writeFile(join(outDir, "images", file), bytes);
      images[ref] = file;
    }
  }
  const full: Design = { ...design, images };
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "design.json"), JSON.stringify(full, null, 2));
  emit(full);
});
