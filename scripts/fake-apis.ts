// Local stand-in for Figma, Braze and SFMC, speaking the slice of each API the
// flow uses. Serves fixtures/figma-nodes.json, keeps templates in memory, and
// appends every request to out/fake-apis.jsonl.
//   PORT=4010 tsx scripts/fake-apis.ts
// Point the flow at it with FIGMA_API_URL, BRAZE_REST_ENDPOINT and SFMC_AUTH_URL
// set to http://localhost:4010, and FIGMA_TOKEN / BRAZE_API_KEY / SFMC_CLIENT_SECRET
// to the values the fake was started with (it rejects anything else).
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const port = Number(process.env.PORT ?? 4010);
const base = `http://localhost:${port}`;
const root = new URL("..", import.meta.url).pathname;
const nodes = JSON.parse(readFileSync(`${root}fixtures/figma-nodes.json`, "utf8"));
const secrets = { figma: process.env.FIGMA_TOKEN, braze: process.env.BRAZE_API_KEY, sfmc: process.env.SFMC_CLIENT_SECRET };
// Placeholder image bytes, distinct per image so their content hashes differ.
const png = (hex: string) => Buffer.from(hex, "hex");
const images: Record<string, Buffer> = {
  "ref-logo": png("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360f8cfc0f01f0005000201" + "e4a1d6c20000000049454e44ae426082"),
  "ref-hero": png("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c63f8ff9fa1ff1f0006fe02fe" + "a4c1d6c20000000049454e44ae426082"),
};
const braze = new Map<string, { email_template_id: string; template_name: string }>();
const sfmc = new Map<number, { id: number; name: string }>();
mkdirSync(`${root}out`, { recursive: true });

const body = (req: IncomingMessage) => new Promise<any>((resolve) => {
  let data = ""; req.on("data", (c) => (data += c)); req.on("end", () => resolve(data ? JSON.parse(data) : undefined));
});
const send = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };

createServer(async (req, res) => {
  const url = new URL(req.url!, base);
  const json = req.method === "GET" ? undefined : await body(req);
  const bearer = req.headers.authorization?.replace(/^Bearer /, "");
  appendFileSync(`${root}out/fake-apis.jsonl`, JSON.stringify({ method: req.method, path: url.pathname + url.search, keys: json && Object.keys(json) }) + "\n");
  const p = url.pathname;

  if (p.startsWith("/v1/")) {
    if (req.headers["x-figma-token"] !== secrets.figma) return send(res, 403, { status: 403, err: "Invalid token" });
    if (/^\/v1\/files\/[^/]+\/nodes$/.test(p)) return send(res, 200, nodes);
    if (/^\/v1\/files\/[^/]+\/images$/.test(p)) return send(res, 200, { error: false, status: 200, meta: { images: Object.fromEntries(Object.keys(images).map((r) => [r, `${base}/img/${r}`])) } });
  }
  if (p.startsWith("/img/")) { res.writeHead(200, { "content-type": "image/png" }); return res.end(images[p.slice(5)]); }

  if (p.startsWith("/templates/email/")) {
    if (bearer !== secrets.braze) return send(res, 401, { message: "Invalid API key" });
    if (p.endsWith("/list")) return send(res, 200, { count: braze.size, templates: [...braze.values()] });
    if (p.endsWith("/create")) {
      const id = `tmpl-${braze.size + 1}`;
      braze.set(id, { email_template_id: id, template_name: json.template_name });
      return send(res, 201, { email_template_id: id, message: "success" });
    }
    if (p.endsWith("/update")) return braze.has(json.email_template_id) ? send(res, 200, { message: "success" }) : send(res, 400, { message: "not found" });
  }

  if (p === "/v2/token") {
    if (json?.client_secret !== secrets.sfmc) return send(res, 401, { error: "invalid_client" });
    return send(res, 200, { access_token: "fake-sfmc-access", token_type: "Bearer", expires_in: 1080, rest_instance_url: `${base}/` });
  }
  if (p.startsWith("/asset/v1/content/assets")) {
    if (bearer !== "fake-sfmc-access") return send(res, 401, { message: "Not Authorized" });
    if (p.endsWith("/query")) {
      const items = [...sfmc.values()].filter((a) => a.name === json.query.leftOperand.value);
      return send(res, 200, { count: items.length, page: 1, pageSize: 2, items });
    }
    if (req.method === "POST") { const id = 9000 + sfmc.size; sfmc.set(id, { id, name: json.name }); return send(res, 201, { id, name: json.name }); }
    if (req.method === "PATCH") { const id = Number(p.split("/").pop()); return sfmc.has(id) ? send(res, 200, sfmc.get(id)) : send(res, 404, { message: "not found" }); }
  }
  send(res, 404, { message: `fake-apis: no route for ${req.method} ${p}` });
}).listen(port, () => console.log(`fake Figma/Braze/SFMC on ${base}`));
