# Neuro Diversa administration preview

Branch: `admin`, created from `dev` at `4e1e9ff`. Deploy this branch to Vercel Preview only.

## Routes

- `/admin/`: interactive administration demo.
- `/admin/#newsletter`, `/admin/#mailing`, `/admin/#social`: direct module links.
- `/estudio/`: existing demo route, retained through the same component.

The public team/group preview remains available. The banner links to `/admin/`.

## CRM reuse

Source: https://github.com/o7digital/crm-suites-o7, local committed revision `a353f69897e8a09b8cc95141fcb46404ad35043c`.

- `frontend/src/app/admin/mail/page.tsx`: adapted email renderer, personalization tokens, text conversion and HTML escaping into `src/lib/crmMailing.ts`. Colors and copy were adapted for Neuro Diversa; the editable body is escaped plain text and CTA links require HTTPS.
- `frontend/src/app/admin/mail/CampaignTools.tsx`: adapted Buffer workflow: recipient channels, optional image, next queue slot or a chosen future date.
- The newsletter template fields follow `frontend/src/lib/newsletterCampaigns.json`.

The demo has no CRM API calls, copied environment files, real contacts, API keys or SMTP connection. The supplied VPS history was used as server context only. VPS1 was inspected read-only; neither VPS nor the source CRM checkout was changed.

## Demonstrated behavior

- Article and group editor preserved from `dev`.
- Newsletter templates, editable content and sender name, optional program card, desktop/mobile email preview, local drafts, HTML download with Mailchimp personalization and unsubscribe placeholders.
- Newsletter text reused in mailing or social posts.
- Mailing audience uses reserved `example.test` addresses, example opt-in flags and interest filters; excluded contacts cannot be selected. Test and campaign deliveries are simulations recorded locally.
- Buffer posts support a local JPG/PNG/WebP preview (up to 2 MB), channel selection, a queue slot or future date, and local draft/preparation history.
- Demo reset clears all Neuro Diversa demo keys, leaving unrelated browser data alone.

Local changes remain in one browser. There is no authentication, shared backend, real delivery or real social publishing in this preview. The final implementation still needs separate client accounts, an isolated backend, the client's authorized mailing list, sender configuration and authorized Buffer channels. HTML personalization/address/unsubscribe placeholders must be completed through the chosen mailing service before real delivery.

## Buffer pricing

Verified on 2026-10-29:

- Free: up to 3 channels, 10 pending posts per channel; slots become available as posts publish.
- Essentials: USD 5 per channel/month equivalent with annual payment of USD 60 per channel, or USD 6 per channel billed monthly.
- Free and Essentials each include one direct Buffer user; this is separate from the two planned Neuro Diversa administration accounts.

Sources: https://buffer.com/pricing and https://buffer.com/resources/buffer-vs-later/

## Validation

`npm run build` builds 36 static pages. Browser checks cover saved newsletter editing and sender persistence, merge tokens, HTML export and escaping, mobile/desktop preview widths, newsletter-to-mailing/Buffer transfer, audience filters/exclusions, simulated deliveries, image validation, future-date validation, price calculations, direct module links and reset. The existing article/group/blog demo flows are also checked. No network writes or calls to CRM, Buffer, Olivia or production analytics are expected in the demo.
