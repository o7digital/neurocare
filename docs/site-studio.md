# Neuro Diversa Site Studio

The existing `/admin/` is the unified entry point. **Editor visual del sitio** embeds the site's actual layout with the same sandboxed companion-document editor used by Nathalie Studio. It covers the 35 current public Spanish/English routes, shared navigation/footer, photographs, links and page SEO. Existing patient, Olivia 3.6, mailing, Buffer, contacts and catalogue modules remain available. No new staff invitations or provider credentials are created.

## Drafts and publication

Directus 12.6.1 is dedicated to Neuro Diversa, with its own PostgreSQL database and persistent upload volume. `site_pages` holds the field catalogue and versioned drafts, `site_releases` stores publication snapshots and `site_settings.active_release` selects the live version. `site_posts` holds the existing article module. A publication includes only the selected page, its language's shared elements and the shared program information. Other page drafts stay private. Concurrent draft versions are checked before saving/publishing.

The public Vercel renderer applies published values to the real Astro document, so text, photos and SEO are present in the delivered HTML. The private backend keeps an encrypted last-published replica for temporary Directus failures. Public patient data is never put into Directus or the public page catalogue. The Olivia/CRM store remains in the existing private backend.

## Operations

- Public unified admin: `https://neurodiversa.mx/admin/`.
- Native owner Directus console: `https://olivia.o7digitalgroup.com/neurodiversa-cms/admin`.
- Compose services `cms` and `cms-database` use private `.env.cms`, `.env.cms-db`; the backend uses private `.env.cms-backend`. These files are runtime secrets, never source files. The owner account is separate from the backend session and uses the owner's existing authorized credentials. The backend's service identity has content/file permissions and no native admin access.
- `npm run build` creates `dist/_studio/pages/*.json`. `cms/site-engine.mjs` is copied into the backend during that build; keep the copies identical. Copy the generated companions to `/opt/o7/apps/neurodiversa/data/site-bundles` and built CSS plus public images/fonts to `data/site-static` when updating the site structure. Then build/restart only the backend service, deploy the Vercel project and verify both published pages and private previews.
- `backend/bootstrap-cms.mjs` runs inside the dedicated CMS container with a private `/tmp/neurodiversa-cms-seed.json`. It adds the schema, imports missing existing content and refreshes field catalogues; it does not replace saved drafts. The seed includes the technical token/password and must stay private. Its `site` and database guard prevent use against another project.
- `backend/install-proxy.py` installs the backend route; `backend/install-cms-proxy.py` adds only the CMS subpath, backing up and validating the shared nginx configuration before reload.
- Back up the existing SQLite store with its online backup API; back up Directus with `pg_dump` from `cms-database` and preserve `cms-uploads`. Do not copy a running PostgreSQL data directory as a backup.

## Verification

`npm run check:admin`, `npm test`, `npm run build`.

For isolated Firefox QA, run `NEURODIVERSA_QA=1 node tests/preview-fixture.mjs` and `NEURODIVERSA_QA=1 node tests/site-preview-server.mjs`, then run `tests/site-browser.mjs`, `tests/browser.mjs` and `tests/channel-browser.mjs` with `PLAYWRIGHT_MODULE` pointing to an installed Playwright module with Firefox available. These fixtures use memory stores and the production CMS adapter with an in-memory Directus REST service; they never call production providers.
