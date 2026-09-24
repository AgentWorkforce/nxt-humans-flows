// Salesforce Marketing Cloud Content Builder HTML email assets (assetType 208).
// Env: SFMC_AUTH_URL (your tenant, e.g. https://<subdomain>.auth.marketingcloudapis.com),
// SFMC_CLIENT_ID, SFMC_CLIENT_SECRET for a server-to-server installed package with
// Assets read/write; optional SFMC_ACCOUNT_ID (business unit MID) and SFMC_CATEGORY_ID (folder).
import { expectOk, type Target } from "./index.ts";

const HTML_EMAIL = { name: "htmlemail", id: 208 };

export const sfmc: Target = {
  unsubscribeUrl: "%%unsub_center_url%%",
  env: ["SFMC_AUTH_URL", "SFMC_CLIENT_ID", "SFMC_CLIENT_SECRET"],
  async upsert(t, env) {
    const token = await expectOk(await fetch(`${env.SFMC_AUTH_URL!.replace(/\/$/, "")}/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials", client_id: env.SFMC_CLIENT_ID, client_secret: env.SFMC_CLIENT_SECRET,
        ...(env.SFMC_ACCOUNT_ID ? { account_id: Number(env.SFMC_ACCOUNT_ID) } : {}),
      }),
    }), "SFMC token");
    const rest = String(token.rest_instance_url).replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" };
    const found = await expectOk(await fetch(`${rest}/asset/v1/content/assets/query`, {
      method: "POST", headers,
      body: JSON.stringify({
        page: { page: 1, pageSize: 2 },
        query: {
          leftOperand: { property: "name", simpleOperator: "equal", value: t.name },
          logicalOperator: "AND",
          rightOperand: { property: "assetType.id", simpleOperator: "equal", value: HTML_EMAIL.id },
        },
        fields: ["id", "name"],
      }),
    }), "SFMC asset query");
    const items: { id: number }[] = found.items ?? [];
    if (items.length > 1) throw new Error(`SFMC has ${items.length} HTML emails named "${t.name}"; rename or delete the duplicates first`);
    const asset = {
      name: t.name,
      assetType: HTML_EMAIL,
      ...(env.SFMC_CATEGORY_ID ? { category: { id: Number(env.SFMC_CATEGORY_ID) } } : {}),
      views: {
        html: { content: t.html },
        text: { content: t.text },
        subjectline: { content: t.subject },
        preheader: { content: t.preheader },
      },
    };
    if (items[0]) {
      await expectOk(await fetch(`${rest}/asset/v1/content/assets/${items[0].id}`, { method: "PATCH", headers, body: JSON.stringify(asset) }), "SFMC asset update");
      return { target: "sfmc", id: String(items[0].id), action: "updated" };
    }
    const created = await expectOk(await fetch(`${rest}/asset/v1/content/assets`, { method: "POST", headers, body: JSON.stringify(asset) }), "SFMC asset create");
    return { target: "sfmc", id: String(created.id), action: "created" };
  },
};
