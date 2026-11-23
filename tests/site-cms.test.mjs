import test from "node:test";
import assert from "node:assert/strict";
import {
  makeBundle,
  applyValues,
  cleanPreview,
  documentId,
  canonicalPath,
} from "../cms/site-engine.mjs";
import { fixtureCms } from "./cms-fixture.mjs";
const sample =
  '<!doctype html><html lang="es"><head><title>Original</title><meta name="description" content="Antes"><meta property="og:title" content="Original"><link rel="stylesheet" href="/_astro/page.css"></head><body><header><a href="/#equipo">Equipo</a></header><main id="inicio"><h1>Conectar &amp; aprender</h1><p>Texto original</p><img src="/hero.webp" alt="Equipo"></main><script>window.live=true</script></body></html>';
test("visual mapping survives unrelated pages and publishes safe text, images, links and SEO", () => {
  const b = makeBundle(sample, "/"),
    other = makeBundle(sample, "/otra/"),
    title = b.fields.find((f) => f.source.startsWith("Conectar")),
    photo = b.fields.find((f) => f.kind === "image"),
    nav = b.fields.find((f) => f.kind === "link");
  assert.equal(nav.id, other.fields.find((f) => f.kind === "link").id);
  assert.equal(new Set(b.fields.map((f) => f.id)).size, b.fields.length);
  const html = applyValues(b, {
    [b.id]: {
      values: {
        [title.id]: "Hola <strong>equipo</strong><script>alert(1)</script>",
        [photo.id]: "cms:11111111-1111-1111-1111-111111111111",
      },
      seo: {
        title: "Nuevo título",
        description: "Nueva descripción",
        noindex: true,
      },
    },
    "global-es": { values: { [nav.id]: "/#contacto" } },
  });
  assert.match(html, /<strong>equipo<\/strong>/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /href="\/#contacto"/);
  assert.match(html, /\/api\/public\/site-image\//);
  assert.match(html, /<title>Nuevo título<\/title>/);
  assert.match(html, /noindex,nofollow/);
  assert.match(html, /window.live=true/);
  assert.doesNotMatch(html, /data-studio-text/);
});
test("private preview strips executable code and keeps only safe inline formatting", () => {
  const b = makeBundle(sample, "/");
  const preview = cleanPreview(applyValues(b, {}, { preview: true }), "/");
  assert.doesNotMatch(preview, /<script|<iframe|onclick=/);
  assert.match(preview, /neurodiversa-preview/);
  assert.match(preview, /preview-asset\?path=/);
  assert.match(preview, /data-studio-text/);
  assert.throws(() => canonicalPath("/../admin"));
  assert.equal(documentId("/").length, 29);
});
test("Directus drafts use revisions and selective publication preserves other drafts", async () => {
  const { cms } = await fixtureCms({
      catalog: [makeBundle(sample, "/"), makeBundle(sample, "/en/")],
    }),
    pages = await cms.pages(),
    home = pages.find((p) => p.path === "/"),
    en = pages.find((p) => p.path === "/en/"),
    f = home.catalog.find((f) => f.kind === "text"),
    ef = en.catalog.find((f) => f.kind === "text"),
    user = { id: "qa-owner" };
  await cms.save(
    {
      documents: [
        { id: home.id, revision: 1, values: { [f.id]: "Borrador ES" } },
        { id: en.id, revision: 1, values: { [ef.id]: "English draft" } },
      ],
    },
    user,
  );
  assert.equal(
    (await cms.published()).documents[home.id].values[f.id],
    undefined,
  );
  await assert.rejects(
    cms.save({ documents: [{ id: home.id, revision: 1, values: {} }] }, user),
    (e) => e.status === 409,
  );
  await assert.rejects(
    cms.publish(user, [{ id: home.id, revision: 1 }]),
    (e) => e.status === 409,
  );
  await cms.publish(user, [{ id: home.id, revision: 2 }]);
  const live = await cms.published();
  assert.equal(live.documents[home.id].values[f.id], "Borrador ES");
  assert.equal(live.documents[en.id].values[ef.id], undefined);
  assert.equal((await cms.page(en.id)).draft.values[ef.id], "English draft");
  await assert.rejects(
    cms.save(
      {
        documents: [
          { id: home.id, revision: 2, values: { [f.id + "evil"]: "bad" } },
        ],
      },
      user,
    ),
    (e) => e.status === 400,
  );
});
test("unpublished photos remain private until a release references them", async () => {
  const { cms } = await fixtureCms({
      catalog: [makeBundle(sample, "/"), makeBundle(sample, "/en/")],
    }),
    id = "11111111-1111-1111-1111-111111111111";
  await assert.rejects(cms.asset(id), (e) => e.status === 404);
  await assert.rejects(
    cms.save(
      {
        documents: [
          {
            id: (await cms.pages())[0].id,
            revision: 1,
            values: { unknown: "x" },
          },
        ],
      },
      { id: "qa" },
    ),
    (e) => e.status === 400,
  );
});
