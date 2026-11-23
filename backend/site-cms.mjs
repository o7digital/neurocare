import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ServiceError } from "./providers.mjs";
import { applyValues, cleanPreview, canonicalPath } from "./site-engine.mjs";
export async function siteRoute({
  path,
  url,
  request,
  body,
  user,
  cms,
  store,
  env,
}) {
  if (!path.startsWith("/api/admin/site/")) return;
  const json = (data) =>
    Response.json(data, { headers: { "Cache-Control": "no-store" } });
  if (!cms.configured)
    throw new ServiceError(
      503,
      "El editor Directus todavía no está conectado.",
    );
  if (path === "/api/admin/site/pages" && request.method === "GET") {
    const pages = await cms.pages(),
      release = await cms.published();
    return json({
      pages,
      release: release.release,
      publishedRevisions: Object.fromEntries(
        Object.entries(release.documents).map(([id, doc]) => [
          id,
          doc.revision,
        ]),
      ),
      directusUrl: env.DIRECTUS_PUBLIC_URL || "",
      user: { role: user.role },
    });
  }
  if (path === "/api/admin/site/save" && request.method === "POST") {
    const input = z
      .object({
        documents: z
          .array(
            z.object({
              id: z.string().max(100),
              revision: z.number().int().positive(),
              values: z.record(z.string(), z.string()).default({}),
              seo: z
                .object({
                  title: z.string().max(180).optional(),
                  description: z.string().max(500).optional(),
                  noindex: z.boolean().optional(),
                })
                .optional(),
            }),
          )
          .max(10),
      })
      .parse(await body());
    return json(await cms.save(input, user));
  }
  if (path === "/api/admin/site/publish" && request.method === "POST") {
    const data = z
      .object({
        confirmed: z.literal(true),
        documents: z
          .array(
            z.object({
              id: z.string().max(100),
              revision: z.number().int().positive(),
            }),
          )
          .min(1)
          .max(10),
      })
      .parse(await body());
    return json(await cms.publish(user, data.documents));
  }
  if (path === "/api/admin/site/upload" && request.method === "POST") {
    const input = z
      .object({
        name: z.string().min(1).max(160),
        base64: z.string().max(2800000),
      })
      .parse(await body());
    if (!store.limit(`cms-upload:${user.id}`, 40, 3600))
      throw new ServiceError(429, "Límite de imágenes por hora alcanzado.");
    return json(await cms.upload(input));
  }
  const asset = path.match(/^\/api\/admin\/site\/asset\/([a-f0-9-]+)$/);
  if (asset && request.method === "GET") return cms.asset(asset[1], true);
  if (path === "/api/admin/site/preview-asset" && request.method === "GET") {
    const file = url.searchParams.get("file") || "";
    if (
      file.includes("..") ||
      !/^\/(?:_astro\/[a-zA-Z0-9._-]+\.css|fonts\/[a-zA-Z0-9._-]+\.(?:woff2?|ttf)|[a-zA-Z0-9._-]+\.(?:webp|png|jpe?g|avif|svg))$/.test(
        file,
      )
    )
      throw new ServiceError(404, "Recurso no permitido.");
    let bytes;
    try {
      bytes = await readFile(
        join(env.SITE_STATIC_DIR || "/data/site-static", file),
      );
    } catch {
      throw new ServiceError(404, "Recurso no disponible.");
    }
    const ext = file.split(".").at(-1),
      mime = {
        css: "text/css",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        webp: "image/webp",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        avif: "image/avif",
        svg: "image/svg+xml",
      }[ext];
    if (ext === "css")
      bytes = Buffer.from(
        bytes
          .toString()
          .replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (match, path) =>
            path.startsWith("/") && !path.includes("..")
              ? 'url("/api/admin/site/preview-asset?file=' +
                encodeURIComponent(path) +
                '")'
              : match,
          ),
      );
    return new Response(bytes, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private,no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path === "/api/admin/site/preview" && request.method === "GET") {
    const page = canonicalPath(url.searchParams.get("page") || "/"),
      pages = await cms.pages(),
      record = pages.find((p) => p.path === page);
    if (!record) throw new ServiceError(404, "Página no encontrada.");
    let bundle;
    try {
      bundle = JSON.parse(
        await readFile(
          join(
            env.SITE_BUNDLE_DIR || "/data/site-bundles",
            record.id + ".json",
          ),
          "utf8",
        ),
      );
    } catch {
      throw new ServiceError(
        502,
        "La vista previa de esta página no está disponible.",
      );
    }
    if (bundle.path !== page)
      throw new ServiceError(502, "Vista previa inválida.");
    const docs = Object.fromEntries(pages.map((p) => [p.id, p.draft || {}]));
    const html = cleanPreview(
      applyValues(bundle, docs, { preview: true }),
      page,
    );
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'",
      },
    });
  }
}
