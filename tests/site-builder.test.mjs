import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "parse5";
import { makeBundle, applyValues, cleanPreview } from "../cms/site-engine.mjs";
import { fixtureCms } from "./cms-fixture.mjs";
import { siteVideoRoute } from "../backend/site-video.mjs";
const sample =
  '<html><head><title>Programa</title></head><body><main><section id="grupos"><p class="lead">Descripción existente</p><p>Otro contenido</p></section></main></body></html>';
test("two operators merge separate fields and preserve a conflicting shared draft", async () => {
  const bundle = makeBundle(sample, "/programa/");
  const { cms } = await fixtureCms({ catalog: [bundle] });
  const [first, second] = bundle.fields.filter((f) => f.kind === "text");
  const owner = { id: "owner" },
    editor = { id: "editor" };
  await cms.save(
    {
      documents: [
        {
          id: bundle.id,
          revision: 1,
          values: { [first.id]: "Contenido de Montserrat" },
          baseValues: { [first.id]: first.source },
        },
      ],
    },
    editor,
  );
  await cms.save(
    {
      documents: [
        {
          id: bundle.id,
          revision: 1,
          values: { [second.id]: "Contenido de Olivier" },
          baseValues: { [second.id]: second.source },
        },
      ],
    },
    owner,
  );
  const saved = await cms.page(bundle.id);
  assert.equal(saved.draft.values[first.id], "Contenido de Montserrat");
  assert.equal(saved.draft.values[second.id], "Contenido de Olivier");
  await assert.rejects(
    cms.save(
      {
        documents: [
          {
            id: bundle.id,
            revision: 1,
            values: { [first.id]: "Reemplazo obsoleto" },
            baseValues: { [first.id]: first.source },
          },
        ],
      },
      owner,
    ),
    (e) => e.status === 409,
  );
  assert.equal(
    (await cms.page(bundle.id)).draft.values[first.id],
    "Contenido de Montserrat",
  );
});
test("rich text, columns, typography and media publish together without changing existing field IDs", async () => {
  const bundle = makeBundle(sample, "/programa/");
  const { cms } = await fixtureCms({ catalog: [bundle] });
  const field = bundle.fields.find((f) => f.kind === "text");
  const id = "11111111-1111-1111-1111-111111111111";
  const blocks = [
    {
      id: "columns-1",
      type: "columns",
      columns: 2,
      anchor: `text:${field.id}`,
      children: [
        [
          {
            id: "text-1",
            type: "text",
            html: '<h2>Objetivos</h2><ul><li>Conversar</li><li><u>Conectar</u></li></ul><p><span data-size="24">Letra grande</span></p>',
            size: 20,
            font: "georgia",
          },
        ],
        [
          { id: "image-1", type: "image", src: `cms:${id}`, alt: "Grupo" },
          { id: "video-1", type: "video", src: "https://youtu.be/dQw4w9WgXcQ" },
        ],
      ],
    },
  ];
  const rich =
    '<p>Texto <strong>existente</strong></p><h2>Más información</h2><p><a href="https://example.test/info">Enlace</a></p><script>window.bad=true</script>';
  await cms.save(
    {
      documents: [
        {
          id: bundle.id,
          revision: 1,
          values: { [field.id]: rich },
          blocks,
          baseBlocks: [],
        },
      ],
    },
    { id: "owner" },
  );
  assert.deepEqual(
    (await cms.published()).documents[bundle.id].blocks,
    undefined,
  );
  await cms.publish({ id: "owner" }, [{ id: bundle.id, revision: 2 }]);
  const snapshot = (await cms.published()).documents;
  const html = applyValues(bundle, snapshot);
  assert.match(html, /<div class="lead"><nd-edit><p>Texto/);
  assert.match(html, /--nd-columns:2/);
  assert.match(html, /font-size:20px;font-family:Georgia/);
  assert.match(html, /<ul><li>Conversar/);
  assert.match(html, /data-size="24"/);
  assert.match(html, /youtube-nocookie.com\/embed\//);
  assert.match(html, /api\/public\/site-image/);
  assert.doesNotMatch(html, /<script|data-studio-text/);
  const reparsed = parse(html);
  const asText = JSON.stringify(reparsed, (key, value) =>
    key === "parentNode" ? undefined : value,
  );
  assert(asText.includes("Texto "));
  const preview = cleanPreview(
    applyValues(bundle, snapshot, { preview: true }),
    "/programa/",
  );
  assert.match(preview, /api\/admin\/site\/asset/);
  assert.match(preview, /block:text-1/);
  assert.doesNotMatch(preview, /<iframe|<script/);
  assert.equal(makeBundle(sample, "/programa/").fields[0].id, field.id);
});
test("video chunks validate ownership, order, retries, format and completed size", async () => {
  const dir = await mkdtemp(join(tmpdir(), "neurodiversa-video-test-"));
  const data = new Map();
  let uploads = 0;
  const store = {
    get: (key) => data.get(key),
    set: (key, value) => data.set(key, structuredClone(value)),
    limit: () => true,
  };
  const cms = {
    uploadVideo: async ({ bytes, mime }) => {
      assert.equal(mime, "video/webm");
      assert.equal(bytes.length, 24);
      uploads++;
      return { id: "video-cms-id" };
    },
  };
  const send = (path, body, user = "editor") =>
    siteVideoRoute({
      path: `/api/admin/site/${path}`,
      request: { method: "POST" },
      body: async () => body,
      user: { id: user },
      store,
      cms,
      env: { SITE_UPLOAD_DIR: dir },
    });
  try {
    const { id } = await (
      await send("video-upload", {
        name: "video.webm",
        mime: "video/webm",
        size: 24,
      })
    ).json();
    const bytes = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(20),
    ]);
    const chunk = { id, offset: 0, base64: bytes.toString("base64") };
    await assert.rejects(
      send("video-upload-chunk", chunk, "another-editor"),
      (e) => e.status === 404,
    );
    await assert.rejects(
      send("video-upload-finish", { id }),
      (e) => e.status === 400,
    );
    await assert.rejects(
      send("video-upload-chunk", { ...chunk, offset: 1 }),
      (e) => e.status === 400,
    );
    assert.equal(
      (await (await send("video-upload-chunk", chunk)).json()).received,
      24,
    );
    assert.equal(
      (await (await send("video-upload-chunk", chunk)).json()).received,
      24,
    );
    assert.equal(
      (await (await send("video-upload-finish", { id })).json()).id,
      "video-cms-id",
    );
    await send("video-upload-finish", { id });
    assert.equal(uploads, 1);
    const bad = await (
      await send("video-upload", {
        name: "bad.webm",
        mime: "video/webm",
        size: 24,
      })
    ).json();
    await send("video-upload-chunk", {
      id: bad.id,
      offset: 0,
      base64: Buffer.alloc(24).toString("base64"),
    });
    await assert.rejects(
      send("video-upload-finish", { id: bad.id }),
      (e) => e.status === 400,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
