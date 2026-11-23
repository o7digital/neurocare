# Neuro Diversa private workspace

Production routes: `/admin/` and `/estudio/`. Both use the same private workspace.
The public site stays on its existing Vercel project, `neurocare`.

## Data flow

Browser → same-origin `/api/*` Vercel bridge → authenticated VPS endpoint
`https://olivia.o7digitalgroup.com/neurodiversa-backend/` → dedicated backend.
Olivia calls its private `neurodiversa-olivia36:8093` engine with a fixed tenant.
No gateway secret, database credential, model credential, SMTP password or Buffer
key is included in browser JavaScript. Public visitors cannot access admin APIs.

The backend runs from `/opt/o7/apps/neurodiversa` on `o7-vps`. Compose creates a
dedicated PostgreSQL database for Olivia 3.6 and a persistent SQLite workspace
at `data/neurodiversa.sqlite` (WAL mode). It exposes no host database/API ports.
The public proxy adds only `/neurodiversa-backend/`; its previous configuration
is backed up and validated with `nginx -t` before reload.

## Modules

- Inbox: contact details, requested service or group, consent date, status and internal notes.
- Channel manager: visitor/assistant/operator transcript, operator replies and AI/manual/closed mode.
- Articles: shared drafts and publication in the ES or EN blog.
- Group: title, proposed start, weeks and minutes, reflected on the public program.
- Mailing: shared newsletter drafts, HTML preview, personalization, explicit test/send actions, opt-in contacts and signed unsubscribe links.
- Buffer: account channels, images by public HTTPS URL, draft, queue or a future schedule.
- Connections: encrypted provider credentials and invitation links restricted to workspace owners.

The mailing and Buffer adapters reuse the behavior of `o7digital/crm-suites-o7`
(`api/src/marketing/buffer.adapter.ts` and `api/src/tenant/tenant.service.ts`).
The previous admin branch's newsletter renderer remains available in
`src/lib/crmMailing.ts`; the live backend renders escaped, personalized HTML.
Buffer requests use its current GraphQL API at `https://api.buffer.com`.

Provider writes run through a persistent outbox. Each campaign revision,
recipient/channel and provider has a unique delivery record. Re-saving unchanged
content retains its revision. An interrupted or failed provider write is marked
`unconfirmed` and is not automatically retried. A provider acceptance does not
claim inbox delivery or completed social publication. Newsletter consent is
separate from permission to follow up on an information request, and is checked
again just before delivery.

## Access deferred by the owner

Human accounts, staff email addresses, SMTP and Buffer accounts are intentionally
left unconfigured. No invitations or emails are sent during provisioning.
When the owner supplies an address, create the first private owner invitation
inside the dedicated container:

```sh
docker exec neurodiversa-backend node manage.mjs invite OWNER_EMAIL owner
```

The command returns a private, single-use activation link valid for seven days.
Handle it as a credential. The recipient chooses their password; registration
without an invitation is blocked. Subsequent invitations can be generated from
Conexiones y accesos. All members share the same workspace; only owners can
change provider credentials or create invitations. Sessions use Better Auth
with HttpOnly, Secure, SameSite=Strict cookies.

## Deployment

Backend dependencies and tests are separate from the static frontend:

```sh
npm ci
npm --prefix backend ci
npm test
npm run build
```

Backend `.env`, `.env.core`, `.env.db`, `.bootstrap.json`, the data directory
and backup data are private runtime state and must never be committed or copied
into an image. `backend/.dockerignore` and the scoped Dockerfile enforce this.
For a new isolated installation, `provision.py` has configure, database, isolate
and bootstrap phases; it does not configure human access or marketing accounts.
For updates, preserve those private files and persistent data, copy the reviewed
backend source, then run `docker compose up -d --build backend`.

The Vercel project uses production-only `NEURODIVERSA_BACKEND_URL` (config) and
`NEURODIVERSA_GATEWAY_KEY` (secret). The latter is transferred through stdin,
without printing it or storing a frontend copy. Stage with the Vercel CLI using
`vercel deploy --prod --skip-domain`, verify, then `vercel promote`.

Olivia engine provenance: `o7digital/olivia-v3` commit
`92864288d7e1919bb7465b5d4076f3410c10f42a`, version 3.6.0, installed locally as
`neurodiversa-olivia36-core:9286428`. Its dedicated system instructions are in
`backend/site-instructions.txt`. Widget appearance and activity/idle indication
are adapted from `o7digital/suitesmine-bot/components/O7Widget.jsx` at `140c1d1`.

## Verification

`npm test` covers access control, invitations, visitor isolation, lead capture,
operator takeover, shared publication, version conflicts, consent/unsubscribe,
provider write deduplication, persistence and the Vercel bridge.

For isolated Firefox browser QA, run `tests/preview-fixture.mjs` with
`NEURODIVERSA_QA=1` and the Astro dev proxy on 127.0.0.1:4328. The fixture uses
only reserved `example.test` contacts and fake provider adapters, with no real
emails or social posts. Run `tests/browser.mjs` with an installed Playwright
module. It exercises lead → inbox → operator → visitor, blog publication,
program updates, newsletter preview, Buffer queue and desktop/mobile layouts.

Production verification must separately check the real 3.6 engine, public
routes, proxy cookies and denied anonymous admin access. Real SMTP and Buffer
delivery remains untested until the owner connects those accounts.
