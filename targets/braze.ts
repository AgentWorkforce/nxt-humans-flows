// Braze email templates (REST API: /templates/email/*).
// Env: BRAZE_REST_ENDPOINT (your instance, e.g. https://rest.iad-01.braze.com), BRAZE_API_KEY
// with templates.email.create, .update and .list permissions.
import { expectOk, type Target } from "./index.ts";

export const braze: Target = {
  unsubscribeUrl: "{{${unsubscribe_url}}}",
  env: ["BRAZE_REST_ENDPOINT", "BRAZE_API_KEY"],
  async upsert(t, env) {
    const base = env.BRAZE_REST_ENDPOINT!.replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${env.BRAZE_API_KEY}`, "Content-Type": "application/json" };
    let existing: string | undefined;
    for (let offset = 0; ; offset += 1000) {
      const page = await expectOk(await fetch(`${base}/templates/email/list?limit=1000&offset=${offset}`, { headers }), "Braze template list");
      const templates: { email_template_id: string; template_name: string }[] = page.templates ?? [];
      existing = templates.find((x) => x.template_name === t.name)?.email_template_id;
      if (existing || templates.length < 1000) break;
    }
    const body = { template_name: t.name, subject: t.subject, preheader: t.preheader, body: t.html, plaintext_body: t.text, tags: [] as string[] };
    if (existing) {
      await expectOk(await fetch(`${base}/templates/email/update`, { method: "POST", headers, body: JSON.stringify({ email_template_id: existing, ...body }) }), "Braze template update");
      return { target: "braze", id: existing, action: "updated" };
    }
    const created = await expectOk(await fetch(`${base}/templates/email/create`, { method: "POST", headers, body: JSON.stringify(body) }), "Braze template create");
    return { target: "braze", id: String(created.email_template_id), action: "created" };
  },
};
