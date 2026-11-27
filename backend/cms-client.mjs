import { randomUUID } from "node:crypto";
import { ServiceError, publicUrl } from "./providers.mjs";
import sharp from "sharp";
import { siteBlocksSchema } from "./site-block-schema.mjs";
export function createCms(env, store, fetcher = fetch) {
  const base = (env.DIRECTUS_URL || "").replace(/\/$/, ""),
    token = env.DIRECTUS_TOKEN,
    configured = !!(base && token);
  let publicationCache,
    cacheAt = 0,
    queue = Promise.resolve();
  const lock = (task) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };
  async function call(path, method = "GET", body) {
    if (!configured)
      throw new ServiceError(503, "Directus todavía no está disponible.");
    let response;
    try {
      response = await fetcher(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(body === undefined
          ? {}
          : { body: body instanceof FormData ? body : JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new ServiceError(
        503,
        "No se pudo conectar con Directus. Tus cambios siguen en el editor.",
      );
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok || !data)
      throw new ServiceError(
        [403, 404].includes(response.status) ? response.status : 502,
        "Directus no confirmó la operación. Tus cambios siguen en el editor.",
      );
    return data.data;
  }
  const pages = () => call("/items/site_pages?limit=-1&sort=path");
  async function published() {
    if (publicationCache && Date.now() - cacheAt < 1500)
      return publicationCache;
    try {
      const settings = await call("/items/site_settings/neurodiversa");
      const release = settings.active_release
        ? await call(`/items/site_releases/${settings.active_release}`)
        : null;
      const value = {
        release: release?.id || "",
        documents: release?.snapshot || {},
        program: settings.program || null,
      };
      publicationCache = value;
      cacheAt = Date.now();
      store.set("cms.lastPublished", value);
      return value;
    } catch (error) {
      const cached = store.get("cms.lastPublished");
      if (cached) return cached;
      throw error;
    }
  }
  function validateValue(field, value) {
    if (typeof value !== "string" || value.length > 12000)
      throw new ServiceError(400, "Revisa el texto seleccionado.");
    if (field.kind === "image") {
      if (/^cms:[a-f0-9-]{36}$/.test(value)) return value;
      if (!value.startsWith("/")) publicUrl(value);
      else if (value.startsWith("//") || value.includes(".."))
        throw new ServiceError(400, "Selecciona una imagen válida.");
    }
    if (
      field.kind === "link" &&
      field.document.startsWith("global-") &&
      value.startsWith("#")
    )
      value = (field.document === "global-en" ? "/en/" : "/") + value;
    if (
      field.kind === "link" &&
      !/^(\/(?!\/)[^\s]*|#[a-zA-Z0-9_-]+|tel:[+\d ().-]+|mailto:[^\s<>]+@[^\s<>]+)$/.test(
        value,
      )
    )
      publicUrl(value, true);
    return value;
  }
  return {
    configured,
    call,
    pages,
    published,
    async page(id) {
      return call(`/items/site_pages/${encodeURIComponent(id)}`);
    },
    async save(input, user) {
      return lock(async () => {
        const all = await pages(),
          updates = [];
        for (const edit of input.documents) {
          const current = all.find((p) => p.id === edit.id);
          if (!current) throw new ServiceError(404, "Página no encontrada.");
          const catalog = new Map(
            (current.catalog || []).map((f) => [f.id, f]),
          );
          // Different fields can merge after another operator saves. The same
          // field (or SEO) still requires review instead of overwriting theirs.
          const blocksMatch =
            !edit.blocks ||
            (edit.baseBlocks &&
              JSON.stringify(edit.baseBlocks) ===
                JSON.stringify(current.draft?.blocks || []));
          const canMerge =
            !edit.seo &&
            blocksMatch &&
            (Object.keys(edit.values || {}).length > 0 || !!edit.blocks) &&
            Object.keys(edit.values).every(
              (id) =>
                Object.hasOwn(edit.baseValues || {}, id) &&
                catalog.has(id) &&
                (current.draft?.values?.[id] ?? catalog.get(id).source) ===
                  edit.baseValues[id],
            );
          if (current.revision !== edit.revision && !canMerge)
            throw new ServiceError(
              409,
              "Esta página cambió en otra sesión. Recarga antes de guardar.",
            );
          const values = { ...(current.draft?.values || {}) };
          for (const [id, value] of Object.entries(edit.values || {})) {
            const field = catalog.get(id);
            if (!field)
              throw new ServiceError(
                400,
                "El campo ya no pertenece a esta página.",
              );
            values[id] = validateValue(field, value);
          }
          const seo = { ...current.draft?.seo, ...edit.seo };
          if (seo.title?.length > 180 || seo.description?.length > 500)
            throw new ServiceError(
              400,
              "Revisa el título y la descripción SEO.",
            );
          updates.push({
            id: current.id,
            draft: {
              ...current.draft,
              values,
              seo,
              ...(edit.blocks
                ? { blocks: siteBlocksSchema.parse(edit.blocks) }
                : {}),
            },
            revision: current.revision + 1,
          });
        }
        if (updates.length) await call("/items/site_pages", "PATCH", updates);
        store.audit(user.id, "site.save", updates.map((p) => p.id).join(","));
        return { ok: true };
      });
    },
    async publish(user, targets) {
      return lock(async () => {
        const all = await pages(),
          previous = await published(),
          snapshot = { ...previous.documents };
        for (const target of targets) {
          const page = all.find((p) => p.id === target.id);
          if (!page) throw new ServiceError(404, "Página no encontrada.");
          if (page.revision !== target.revision)
            throw new ServiceError(
              409,
              "El borrador cambió. Recarga antes de publicar.",
            );
          snapshot[page.id] = {
            values: page.draft?.values || {},
            seo: page.draft?.seo || {},
            blocks: page.draft?.blocks || [],
            revision: page.revision,
          };
        }
        const existing = await call("/items/site_settings/neurodiversa");
        let program = existing.program ? { ...existing.program } : null;
        if (targets.some((t) => t.id === "global-program")) {
          const doc = all.find((p) => p.id === "global-program");
          for (const field of doc?.catalog || []) {
            const value = doc.draft?.values?.[field.id];
            if (value !== undefined && field.runtime) {
              program ??= {};
              const key = field.runtime.split(".")[1];
              program[key] = ["weeks", "minutes"].includes(key)
                ? Number(value)
                : String(value).replace(/<[^>]*>/g, "");
            }
          }
        }
        if (
          program &&
          ((program.weeks !== undefined &&
            (!Number.isInteger(program.weeks) ||
              program.weeks < 1 ||
              program.weeks > 52)) ||
            (program.minutes !== undefined &&
              (!Number.isInteger(program.minutes) ||
                program.minutes < 15 ||
                program.minutes > 240)))
        )
          throw new ServiceError(
            400,
            "Revisa las semanas y los minutos del programa.",
          );
        const id = randomUUID();
        await call("/items/site_releases", "POST", {
          id,
          snapshot,
          status: "published",
          author: user.id,
          created: new Date().toISOString(),
        });
        await call("/items/site_settings/neurodiversa", "PATCH", {
          active_release: id,
          program,
        });
        publicationCache = null;
        cacheAt = 0;
        await published();
        store.audit(user.id, "site.publish", id);
        return { id };
      });
    },
    async upload(file) {
      const input = Buffer.from(file.base64, "base64");
      if (input.length > 2000000)
        throw new ServiceError(413, "Elige una imagen de hasta 2 MB.");
      let bytes;
      try {
        const image = sharp(input, { limitInputPixels: 30000000 });
        if (
          !["jpeg", "png", "webp", "avif"].includes(
            (await image.metadata()).format,
          )
        )
          throw new Error();
        bytes = await image
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toBuffer();
      } catch {
        throw new ServiceError(
          400,
          "Usa una imagen JPG, PNG, WebP o AVIF válida.",
        );
      }
      const form = new FormData();
      form.set("title", file.name);
      form.set(
        "file",
        new Blob([bytes], { type: "image/webp" }),
        file.name.replace(/\.[^.]+$/, ".webp"),
      );
      const result = await call("/files", "POST", form);
      return { id: result.id, name: result.title };
    },
    async uploadVideo({ name, mime, bytes }) {
      const form = new FormData();
      form.set("title", name);
      form.set("file", new Blob([bytes], { type: mime }), name);
      const result = await call("/files", "POST", form);
      return { id: result.id, name: result.title };
    },
    async asset(id, privateAsset = false, range = null) {
      if (!/^[a-f0-9-]{36}$/.test(id))
        throw new ServiceError(404, "Imagen no disponible.");
      if (!privateAsset) {
        const current = await published();
        if (
          !Object.values(current.documents).some(
            (doc) =>
              Object.values(doc.values || {}).includes(`cms:${id}`) ||
              JSON.stringify(doc.blocks || []).includes(`"src":"cms:${id}"`),
          )
        )
          throw new ServiceError(404, "Imagen no publicada.");
      }
      const response = await fetcher(`${base}/assets/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (
        !response.ok ||
        !/^(image\/(?:jpeg|png|webp|avif)|video\/(?:mp4|webm))(?:;|$)/.test(
          response.headers.get("Content-Type") || "",
        )
      )
        throw new ServiceError(404, "Imagen no disponible.");
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type"),
          "Cache-Control": privateAsset
            ? "private, no-store"
            : "public,max-age=3600",
          "X-Content-Type-Options": "nosniff",
          ...(response.headers.get("content-range")
            ? { "Content-Range": response.headers.get("content-range") }
            : {}),
          ...(response.headers.get("accept-ranges")
            ? { "Accept-Ranges": response.headers.get("accept-ranges") }
            : {}),
        },
      });
    },
    async posts() {
      return call("/items/site_posts?limit=-1&sort=-updated");
    },
    async savePost(data, user) {
      return lock(async () => {
        const current = data.id
          ? await call(`/items/site_posts/${data.id}`).catch((e) => {
              if (e.status === 404) return null;
              throw e;
            })
          : null;
        if (current && current.version !== data.version)
          throw new ServiceError(
            409,
            "El artículo cambió. Recarga antes de guardar.",
          );
        const value = {
          ...data,
          id: data.id || randomUUID(),
          version: current ? current.version + 1 : 1,
          updated: new Date().toISOString(),
        };
        await call(
          current ? `/items/site_posts/${value.id}` : "/items/site_posts",
          current ? "PATCH" : "POST",
          value,
        );
        store.audit(user.id, "post.save", value.id);
        return value.id;
      });
    },
    async deletePost(id) {
      await call(`/items/site_posts/${id}`, "DELETE");
    },
    async program() {
      return (await call("/items/site_settings/neurodiversa")).program || null;
    },
    async saveProgram(data) {
      await call("/items/site_settings/neurodiversa", "PATCH", {
        program: data,
      });
      const all = await pages(),
        doc = all.find((p) => p.id === "global-program");
      if (doc) {
        const values = { ...doc.draft?.values };
        for (const field of doc.catalog || [])
          if (field.runtime) {
            const key = field.runtime.split(".")[1];
            if (data[key] !== undefined) values[field.id] = String(data[key]);
          }
        await call(`/items/site_pages/${doc.id}`, "PATCH", {
          draft: { ...doc.draft, values },
          revision: doc.revision + 1,
        });
      }
      publicationCache = null;
      cacheAt = 0;
    },
  };
}
