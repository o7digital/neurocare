// In-memory Directus REST fixture. Runs the production CMS adapter without live data.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createCms } from "../backend/cms-client.mjs";
export async function fixtureCms(options = {}) {
  const catalog =
      options.catalog ||
      JSON.parse(
        await readFile(
          new URL("../dist/_studio/catalog.json", import.meta.url),
          "utf8",
        ),
      ),
    tables = {
      site_pages: [],
      site_settings: [
        { id: "neurodiversa", active_release: "initial", program: null },
      ],
      site_releases: [{ id: "initial", snapshot: {} }],
      site_posts: [],
    },
    docs = new Map(),
    assets = new Map(),
    assetTypes = new Map(),
    replica = new Map();
  for (const p of catalog)
    docs.set(p.id, {
      id: p.id,
      path: p.path,
      locale: p.locale,
      title: p.title,
      catalog: [],
      draft: {
        values: {},
        seo: { title: p.title, description: p.description },
      },
      revision: 1,
    });
  for (const page of catalog)
    for (const f of page.fields) {
      if (!docs.has(f.document))
        docs.set(f.document, {
          id: f.document,
          path: null,
          locale: f.document === "global-en" ? "en" : "es",
          title: f.document,
          catalog: [],
          draft: { values: {}, seo: {} },
          revision: 1,
        });
      const doc = docs.get(f.document);
      if (!doc.catalog.some((x) => x.id === f.id)) doc.catalog.push(f);
    }
  tables.site_pages = [...docs.values()];
  tables.site_releases[0].snapshot = Object.fromEntries(
    tables.site_pages.map((p) => [
      p.id,
      { ...structuredClone(p.draft), revision: p.revision },
    ]),
  );
  const fetcher = async (url, options = {}) => {
    const path = new URL(url).pathname,
      method = options.method || "GET";
    let result;
    if (path === "/files" && method === "POST") {
      const file = options.body.get("file"),
        id = randomUUID();
      assets.set(id, new Uint8Array(await file.arrayBuffer()));
      assetTypes.set(id, file.type);
      return Response.json({ data: { id, title: options.body.get("title") } });
    }
    if (path.startsWith("/assets/")) {
      const id = path.split("/").at(-1),
        value = assets.get(id);
      return value
        ? new Response(value, {
            headers: { "Content-Type": assetTypes.get(id) || "image/webp" },
          })
        : new Response(null, { status: 404 });
    }
    const match = path.match(/^\/items\/([a-z_]+)(?:\/([^/]+))?$/);
    if (!match || !tables[match[1]])
      return Response.json({ errors: [] }, { status: 404 });
    const table = tables[match[1]],
      id = match[2],
      body = options.body ? JSON.parse(options.body) : undefined;
    if (method === "GET") result = id ? table.find((r) => r.id === id) : table;
    if (method === "POST") {
      table.push(structuredClone(body));
      result = body;
    }
    if (method === "PATCH") {
      const updates = id ? [{ ...body, id }] : body;
      for (const edit of updates) {
        const current = table.find((r) => r.id === edit.id);
        if (!current) return Response.json({ errors: [] }, { status: 404 });
        Object.assign(current, structuredClone(edit));
      }
      result = id ? table.find((r) => r.id === id) : updates;
    }
    if (method === "DELETE") {
      const index = table.findIndex((r) => r.id === id);
      if (index >= 0) table.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    return result
      ? Response.json({ data: result })
      : Response.json({ errors: [] }, { status: 404 });
  };
  return {
    cms: createCms(
      { DIRECTUS_URL: "http://fixture.test", DIRECTUS_TOKEN: "fixture-only" },
      {
        get: (key) => replica.get(key),
        set: (key, value) => replica.set(key, structuredClone(value)),
        audit: () => {},
      },
      fetcher,
    ),
    tables,
    assets,
  };
}
