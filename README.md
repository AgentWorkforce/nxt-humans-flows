# NXT Humans flows

## Figma → React Email → Braze / Salesforce Marketing Cloud

`figma-to-email.flow.ts` turns one email frame in Figma into a template on your send platform.

| Step | Who | What happens |
|---|---|---|
| 1 | System | Checks the Figma and send-platform credentials are present |
| 2 | System | Fetches the frame from Figma and downloads its images to `out/<name>/images/` |
| 3 | System | Maps every design-library instance (`Email/Hero`, `Email/Button`, …) to its approved React Email component |
| 4 | Model | Maps any other layer (detached instances, loose text) onto approved components only; each answer is schema-checked and sent back with findings until it passes (3 tries) |
| 5 | System | Renders through the approved components; checks size (Gmail clips at 102KB), alt text, https links, unsubscribe link |
| 6 | Judges | Score the email against three rubrics (`lib/evals.ts`): copy matches Figma, on brand, accessible |
| 7 | Classifier | Routes it: `auto-deploy` when every judge passed clean and all content came from library components, else `alert-human` |
| 8 | **You** | Only on `alert-human`: review `out/<name>/email.html` with the judges' findings, and approve |
| 9 | System | Creates the template, or updates the one with the same name |

Judge and classifier steps (`f.judge`, `f.classify`) arrive in the next relayflows release; `lib/next-surface.ts` declares them so the flow typechecks today. Until then a run completes steps 1–5 and stops at step 6 with `f.judge is not a function`.

### The component library

`library/registry.ts` is the approved set, and each entry names its Figma library component and properties:

| Figma component | React Email component | Figma properties |
|---|---|---|
| `Email/Meta` | — (sets subject + preheader) | Subject, Preheader |
| `Email/Header` | `Header` | Logo *(image layer)*, Logo alt, Link |
| `Email/Hero` | `Hero` | Image *(image layer)*, Image alt, Headline, Body, CTA label, CTA URL |
| `Email/Heading` | `Heading` | Text, Level (h1/h2/h3) |
| `Email/Text` | `Text` | Text, Align (left/center) |
| `Email/Button` | `Button` | Label, URL, Variant (primary/secondary) |
| `Email/Image` | `Image` | Image *(image layer)*, Alt, Link |
| `Email/Divider` | `Divider` | — |
| `Email/Footer` | `Footer` (+ platform unsubscribe link) | Company, Address |

Library conventions:
- Text props come from a TEXT component property, else from a text layer with the same name.
- Images come from the image-filled layer with the prop's name.
- A boolean `Show <prop>` set to false drops that prop.
- A URL may also be a hyperlink on the text.

Components live in `library/components.tsx` and tokens in `library/theme.ts`. Replace the tokens with your library's color and text styles.

### Run it

Node 22.18+ and a signed-in [Claude Code](https://claude.com/claude-code).

```sh
npm install
export FIGMA_TOKEN=...                                          # file_content:read
export BRAZE_REST_ENDPOINT=https://rest.iad-01.braze.com BRAZE_API_KEY=...   # templates.email.{list,create,update}
# or
export SFMC_AUTH_URL=https://<subdomain>.auth.marketingcloudapis.com SFMC_CLIENT_ID=... SFMC_CLIENT_SECRET=...
# optional: SFMC_ACCOUNT_ID (business unit), SFMC_CATEGORY_ID (Content Builder folder)

npx flows run figma-to-email.flow.ts --local-agent --input '{
  "figmaFileKey": "<from the Figma URL>",
  "figmaNodeId": "12-34",
  "name": "2026-10 Fall launch",
  "target": "braze",
  "imageBaseUrl": "https://cdn.example.com/email/fall",
  "reviewer": "you"
}'
```

`figmaNodeId` is the `node-id` of the email's top-level frame in the Figma URL. `name` is the template name on the platform. `subject` and `preheader` override the `Email/Meta` layer.

When the classifier alerts you, the run parks and prints the preview path plus two commands: `npx flows answer … yes` (or `no`) and `npx flows resume …`. Once alerted, nothing is deployed until you answer yes. Deploy refuses if `email.html` changed after you approved it.

**Credentials are read by the local `relayflowd` daemon, which keeps the environment it started with.** After exporting new credentials, stop it with `pkill -f 'relayflowd --data-dir'`; the next run starts a fresh one. Step 1 refuses up front if any credential is missing.

### Images

Images are exported from Figma at full resolution and named by content hash. Upload `out/<name>/images/` to `imageBaseUrl` before sending. Figma's own image URLs expire, and the checks refuse them.

### Try it without accounts

`scripts/fake-apis.ts` stands in for Figma, Braze and SFMC. It serves `fixtures/figma-nodes.json`, a campaign frame that mixes library instances, a detached feature block and a loose P.S. line.

```sh
FIGMA_TOKEN=fake-figma BRAZE_API_KEY=fake-braze SFMC_CLIENT_SECRET=fake-sfmc npm run fake-apis &
export FIGMA_API_URL=http://localhost:4010 FIGMA_TOKEN=fake-figma \
  BRAZE_REST_ENDPOINT=http://localhost:4010 BRAZE_API_KEY=fake-braze \
  SFMC_AUTH_URL=http://localhost:4010 SFMC_CLIENT_ID=x SFMC_CLIENT_SECRET=fake-sfmc
npx flows run figma-to-email.flow.ts --local-agent --input '{"figmaFileKey":"FALLKEY","figmaNodeId":"12-34","name":"2026-10 Fall launch","target":"sfmc","imageBaseUrl":"https://cdn.example.com/fall","reviewer":"you"}'
```

Recorded runs in `evidence/run/` predate the judge and classifier steps. They cover Braze create and update, SFMC create and update, a declined review, the missing-credential refusal, and a preview screenshot.

### Develop

```sh
npm test          # mapping, validation, rendering, checks
npm run typecheck
npx flows check figma-to-email.flow.ts
```
