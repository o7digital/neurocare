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
- Channel manager: standalone full-window Olivia console at `/inbox/`, ported from `suitesmine-bot/app/inbox/page.js` (the reference screenshot). Includes live counts and filters, assignment, read state, search, version-checked takeover/AI return/resolve/reopen, customer tags, editable contact profile, internal notes, consent-based page history, quick replies, Olivia 3.6 draft suggestions, private attachments and transcript export. It is also available from the backend’s Olivia navigation item.
- Olivia automation: owner-controlled automatic replies and explicit human-request handoff, with editable quick replies. A visitor message reopens a resolved conversation. When control returns to AI, the actual operator exchange is passed as context; private notes are excluded.
- Articles: shared drafts and publication in the ES or EN blog.
- Group: title, proposed start, weeks and minutes, reflected on the public program.
- Mailing: monthly campaigns, three editable starter templates, live desktop/mobile previews, full document editing with TipTap, design/gallery controls, personalization, HTML export, Mailchimp draft creation and SMTP test/send actions.
- Buffer Studio: campaign library grouped by month, linked newsletter activities, image library/upload, per-channel destinations, draft/queue/scheduled delivery and a paginated remote status refresh. Existing social drafts are preserved when preparing a newsletter again.
- Catalog: reusable, versioned ES/EN activities and resources with dates, venue, image and official link.
- Public agenda: explicit publication creates a snapshot at `/agenda/?id=…`; later private draft edits do not change it until it is published again. The link can be withdrawn.
- Media: private staff upload of valid images up to 2 MB, decoded and normalized by Sharp into a public 1200×900 JPEG. SVG and invalid files are rejected; original bytes and metadata are discarded.
- Connections: encrypted provider credentials and invitation links restricted to workspace owners.

The newsletter editors and preview are ported from `crm-suitesmine` dev
`bfd0ce3` (`frontend/src/app/admin/mail/page.tsx`). Buffer Studio follows
`CampaignTools.tsx` and `BufferSyncPanel.tsx`; the three-pane inbox follows
`suitesmine-bot/app/inbox/page.js`. Hotel events, credentials and tenant data
are not copied. `backend/newsletter.mjs` is the shared HTML renderer; this pure
module is the only backend source included in the frontend deployment.
The channel console uses the existing Better Auth account and this dedicated tenant. It does not copy the reference instance’s clients, messages, access configuration or provider secrets. Website chat is active; external mailbox and Meta channels remain explicitly unconnected, as requested.

Server-side sanitization uses sanitize-html, and campaign revisions retain their
own design snapshot. Mailchimp uses its 3.0 draft/content API; Buffer uses its
GraphQL API at `https://api.buffer.com`. Mailchimp remote campaign IDs are
persisted before content upload so a partial failure remains identifiable.

Provider writes run through a persistent outbox. Each campaign revision,
recipient/channel and provider has a unique delivery record. Re-saving unchanged
content retains its revision. An interrupted or failed provider write is marked
`unconfirmed` and is not automatically retried. A provider acceptance does not
claim inbox delivery or completed social publication. Newsletter consent is
separate from permission to follow up on an information request, and is checked
again just before delivery.

## Access and deferred connections

The owner account requested for `olivier.steineur@gmail.com` has been activated.
Its password is runtime state and is never stored in this repository. Staff
accounts and Mailchimp, SMTP and Buffer credentials remain deferred. No staff
invitations, emails or posts are sent during this update. For a future approved
invitation, run inside the dedicated container:

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
npm run check:admin
npm run build
```

Backend `.env`, `.env.core`, `.env.db`, `.bootstrap.json`, the data directory
and backup data are private runtime state and must never be committed or copied
into an image. `backend/.dockerignore` and the scoped Dockerfile enforce this.
For a new isolated installation, `provision.py` has configure, database, isolate
and bootstrap phases; it does not configure human access or marketing accounts.
For updates, preserve those private files and persistent data, copy the reviewed
backend source, then run `docker compose up -d --build backend`. Back up SQLite
using its online backup API before an update. `install-proxy.py` upgrades only
the dedicated route to a 3 MB request limit for image upload.
For isolated HTTP development, `PUBLIC_SITE_URL` can retain the canonical HTTPS
media URL while `SITE_URL` supplies the local authentication origin.

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
program updates, live preview, full document editing, image upload, catalog,
public agenda snapshot, social draft preparation, Buffer queue/status and
desktop/mobile layouts.

Production verification must separately check the real 3.6 engine, public
routes, proxy cookies and denied anonymous admin access. Real Mailchimp, SMTP and Buffer
provider writes remain untested until the owner connects those accounts.

## Channel console verification

`tests/channel-browser.mjs` runs the exact reference layout in Firefox against the isolated fixture. It exercises a real fixture visitor and a separate authenticated operator context: group lead and chat, consenting page history, tags, takeover, private notes, AI draft without automatic sending, a private text attachment delivered back to that visitor, resolution, reopening, reload persistence and mobile drawers. The backend tests additionally cover competing operators, stale versions, read isolation, provider handoff context and binary delivery through the Vercel bridge. No production patients or external channel credentials are used.

The new channel tables are additive. Take a SQLite online backup before deploying. Do not delete or reset existing visitors, messages, leads, users or authentication state.
