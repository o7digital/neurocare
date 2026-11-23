// Serve the real Astro document with its published Directus values, including SEO.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { applyValues, canonicalPath, documentId } from "../cms/site-engine.mjs";
const bundles = new Map(),
  lastGood = new Map();
export default async function handler(req, res) {
  const input = new URL(req.url, "https://neurodiversa.mx");
  let path;
  try {
    path = canonicalPath(
      req.query?.page || input.searchParams.get("page") || "/",
    );
  } catch {
    res.statusCode = 404;
    res.end("Página no encontrada.");
    return;
  }
  try {
    const id = documentId(path);
    if (!bundles.has(id))
      bundles.set(
        id,
        readFile(
          join(process.cwd(), "dist", "_studio", "pages", id + ".json"),
          "utf8",
        )
          .then(JSON.parse)
          .catch((error) => {
            bundles.delete(id);
            throw error;
          }),
      );
    const bundle = await bundles.get(id);
    if (bundle.path !== path) throw new Error("Invalid page");
    if (
      !process.env.NEURODIVERSA_BACKEND_URL ||
      !process.env.NEURODIVERSA_GATEWAY_KEY
    )
      throw new Error("Missing site connection");
    const upstream = await fetch(
      `${process.env.NEURODIVERSA_BACKEND_URL.replace(/\/$/, "")}/api/public/site-page?page=${encodeURIComponent(path)}`,
      {
        headers: { "x-neurodiversa-key": process.env.NEURODIVERSA_GATEWAY_KEY },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!upstream.ok) throw new Error("Published content unavailable");
    const data = await upstream.json();
    const html = applyValues(bundle, data.documents || {});
    lastGood.set(path, html);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Neurodiversa-Publication", data.release || "initial");
    res.end(html);
  } catch (error) {
    if (lastGood.has(path)) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(lastGood.get(path));
      return;
    }
    res.statusCode = error.code === "ENOENT" ? 404 : 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neuro Diversa</title><body style="font:18px Arial;max-width:650px;margin:12vh auto;padding:25px"><h1>Neuro Diversa</h1><p>La página no está disponible en este momento. Intenta de nuevo en unos instantes.</p><a href="/">Volver al inicio</a></body></html>',
    );
  }
}
