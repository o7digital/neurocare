// Newsletter and campaign workspace adapted from crm-suitesmine admin/mail.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { ServiceError, publicUrl } from "./providers.mjs";
import { sanitizeRichHtml } from "./newsletter.mjs";
const str = (max = 200) => z.string().trim().max(max);
const stamp = () => new Date().toISOString();
sharp.cache({ memory: 16, files: 0, items: 20 });
sharp.concurrency(1);
export const eventSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive().optional(),
  category: str(100),
  title: str(200).min(1),
  date: str(200),
  venue: str(240),
  description: str(5000),
  url: str(2000),
  sourceLabel: str(100),
  imageUrl: str(2000).default(""),
  month: str(40).default(""),
  sortDate: z.union([z.literal(""), z.iso.date()]).default(""),
  language: z.enum(["es", "en"]).default("es"),
});
export const designSchema = z.object({
  heroImage: str(2000).default(""),
  gallery: z.array(str(2000)).max(8).default([]),
  address: str(500).default(
    "Cracovia 72, Torre A, Oficina 216 · San Ángel, CDMX",
  ),
  phone: str(100).default("55 7191 9515"),
  websiteUrl: str(2000).default("https://neurodiversa.mx"),
  reservationUrl: str(2000).default(
    "https://neurodiversa.mx/programas/habilidades-sociales/",
  ),
});
export const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  kind: z.enum(["email", "social"]),
  subject: str(180).min(1),
  body: str(30000).min(1),
  bodyHtml: str(70000).default("").transform(sanitizeRichHtml),
  headline: str(200).default(""),
  preheader: str(200).default(""),
  eyebrow: str(200).default(""),
  heroImage: str(2000).default(""),
  cta: str(100).default(""),
  ctaUrl: str(2000).default(""),
  mediaUrl: str(2000).default(""),
  channelIds: z.array(str(200)).max(20).default([]),
  mode: z.enum(["draft", "queue", "scheduled"]).default("draft"),
  dueAt: str(50).default(""),
  highlights: z.array(str(400)).max(12).default([]),
  events: z.array(eventSchema).max(60).default([]),
  month: str(40).default(""),
  monthKey: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  year: z.number().int().min(2026).max(2100).optional(),
  status: z.enum(["DRAFT", "READY"]).default("DRAFT"),
  sendWindow: str(300).default(""),
  segment: str(1000).default(""),
  goal: str(1000).default(""),
  language: z.enum(["es", "en"]).default("es"),
  sourceCampaignId: z.string().uuid().optional(),
  sourceEventId: z.string().uuid().optional(),
  design: designSchema.optional(),
});
export function validateCampaignUrls(campaign) {
  for (const key of ["heroImage", "mediaUrl", "ctaUrl"])
    if (campaign[key]) publicUrl(campaign[key]);
  for (const event of campaign.events || [])
    for (const key of ["url", "imageUrl"])
      if (event[key]) publicUrl(event[key]);
  if (campaign.design) validateDesign(campaign.design);
}
function validateDesign(design) {
  for (const url of [
    design.heroImage,
    design.websiteUrl,
    design.reservationUrl,
    ...design.gallery,
  ])
    if (url) publicUrl(url);
}
export function marketingWorkspace(store, site) {
  const { db } = store;
  return {
    catalog: db
      .prepare("SELECT * FROM catalog ORDER BY updated DESC")
      .all()
      .map((row) => ({
        ...JSON.parse(row.data),
        id: row.id,
        version: row.version,
      })),
    publications: db
      .prepare(
        "SELECT id,campaign_id,month_key,version,updated FROM publications ORDER BY month_key DESC",
      )
      .all(),
    bufferRemote: store.get("bufferRemote", {}),
    bufferCheckedAt: store.get("bufferCheckedAt", ""),
    marketingSetup: store.get("marketingSetup", {}),
    media: db
      .prepare(
        "SELECT id,name,created FROM media ORDER BY created DESC LIMIT 100",
      )
      .all()
      .map((row) => ({ ...row, url: `${site}/api/public/media/${row.id}` })),
  };
}
export async function publicMarketing(path, store) {
  const media = path.match(/^\/api\/public\/media\/([a-f0-9-]+)$/);
  if (media) {
    const row = store.db
      .prepare("SELECT bytes FROM media WHERE id=?")
      .get(media[1]);
    if (!row) throw new ServiceError(404, "Imagen no encontrada.");
    return new Response(row.bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const agenda = path.match(/^\/api\/public\/agenda\/([a-f0-9-]+)$/);
  if (agenda) {
    const row = store.db
      .prepare("SELECT * FROM publications WHERE id=?")
      .get(agenda[1]);
    if (!row) throw new ServiceError(404, "Esta agenda no está publicada.");
    return Response.json(
      { ...JSON.parse(row.data), id: row.id, updated: row.updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function marketingRoute({
  path,
  request,
  body,
  user,
  store,
  providers,
  site,
  loadCampaign,
  saveVersioned,
}) {
  const { db } = store,
    json = (data) =>
      Response.json(data, { headers: { "Cache-Control": "no-store" } });
  if (path === "/api/admin/design" && request.method === "PUT") {
    const data = designSchema.parse(await body());
    validateDesign(data);
    store.set("marketingSetup", data);
    store.audit(user.id, "design.save", "workspace");
    return json({ ok: true });
  }
  if (path === "/api/admin/media" && request.method === "POST") {
    if (!store.limit(`uploads:${user.id}`, 30, 3600))
      throw new ServiceError(
        429,
        "Alcanzaste el límite de imágenes por hora. Intenta más tarde.",
      );
    const data = z
      .object({ name: str(160).min(1), base64: z.string().max(2800000) })
      .parse(await body());
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))
      throw new ServiceError(400, "Archivo de imagen inválido.");
    const input = Buffer.from(data.base64, "base64");
    if (input.length > 2000000)
      throw new ServiceError(413, "Elige una imagen de hasta 2 MB.");
    let bytes;
    try {
      const image = sharp(input, { limitInputPixels: 30000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format))
        throw new Error();
      bytes = await image
        .rotate()
        .resize(1200, 900, { fit: "cover" })
        .jpeg({ quality: 87 })
        .toBuffer();
    } catch {
      throw new ServiceError(
        400,
        "Usa una imagen JPG, PNG, WebP o AVIF válida.",
      );
    }
    const id = randomUUID();
    db.prepare("INSERT INTO media VALUES (?,?,?,?)").run(
      id,
      data.name,
      bytes,
      stamp(),
    );
    store.audit(user.id, "media.upload", id);
    return json({ id, name: data.name, url: `${site}/api/public/media/${id}` });
  }
  if (path === "/api/admin/catalog" && request.method === "POST") {
    const data = eventSchema.parse(await body());
    for (const key of ["imageUrl", "url"]) if (data[key]) publicUrl(data[key]);
    const old = db
      .prepare("SELECT version FROM catalog WHERE id=?")
      .get(data.id);
    if (old && old.version !== data.version)
      throw new ServiceError(
        409,
        "Esta actividad cambió. Recarga antes de guardar.",
      );
    const { id, version, ...doc } = data;
    db.prepare(
      "INSERT INTO catalog VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=catalog.version+1,updated=excluded.updated",
    ).run(id, JSON.stringify(doc), stamp());
    store.audit(user.id, "catalog.save", id);
    return json({ ok: true, id });
  }
  const catalog = path.match(/^\/api\/admin\/catalog\/([a-f0-9-]+)$/);
  if (catalog && request.method === "DELETE") {
    db.prepare("DELETE FROM catalog WHERE id=?").run(catalog[1]);
    store.audit(user.id, "catalog.delete", catalog[1]);
    return json({ ok: true });
  }
  if (path === "/api/admin/buffer/sync" && request.method === "POST") {
    const connections = store.get("connections", {});
    const result = await providers.bufferPosts(connections.buffer);
    store.set("bufferRemote", result.posts);
    store.set("bufferCheckedAt", stamp());
    store.audit(user.id, "buffer.refresh", "workspace");
    return json({ ...result, checkedAt: store.get("bufferCheckedAt") });
  }
  if (path === "/api/admin/mailchimp/test" && request.method === "POST")
    return json(
      await providers.mailchimpPing(store.get("connections", {}).mailchimp),
    );
  const campaign = path.match(
    /^\/api\/admin\/campaigns\/([a-f0-9-]+)\/(publish|prepare-social)$/,
  );
  if (campaign && request.method === "POST") {
    const doc = loadCampaign(campaign[1]),
      data = z
        .object({ version: z.number().int().positive() })
        .parse(await body());
    if (data.version !== doc.version)
      throw new ServiceError(
        409,
        "Guarda y recarga la versión actual de la campaña.",
      );
    if (campaign[2] === "publish") {
      if (doc.kind !== "email")
        throw new ServiceError(400, "Selecciona una newsletter.");
      const id =
        db
          .prepare("SELECT id FROM publications WHERE campaign_id=?")
          .get(doc.id)?.id || randomUUID();
      const snapshot = {
        subject: doc.subject,
        headline: doc.headline,
        preheader: doc.preheader,
        body: doc.body,
        bodyHtml: sanitizeRichHtml(doc.bodyHtml || ""),
        heroImage: doc.heroImage,
        cta: doc.cta,
        ctaUrl: doc.ctaUrl,
        month: doc.month,
        year: doc.year,
        language: doc.language,
        highlights: doc.highlights,
        events: doc.events,
      };
      db.prepare(
        "INSERT INTO publications VALUES (?,?,?,?,?,?) ON CONFLICT(campaign_id) DO UPDATE SET month_key=excluded.month_key,data=excluded.data,version=excluded.version,updated=excluded.updated",
      ).run(
        id,
        doc.id,
        doc.monthKey || "",
        JSON.stringify(snapshot),
        doc.version,
        stamp(),
      );
      store.audit(user.id, "agenda.publish", id);
      return json({ id, url: `${site}/agenda/?id=${id}` });
    }
    const created = [],
      existing = db
        .prepare("SELECT data,id FROM campaigns WHERE kind='social'")
        .all()
        .map((row) => ({ ...JSON.parse(row.data), id: row.id }));
    for (const event of doc.events || []) {
      if (
        existing.some(
          (c) => c.sourceCampaignId === doc.id && c.sourceEventId === event.id,
        )
      )
        continue;
      const social = campaignSchema.parse({
        kind: "social",
        subject: event.title,
        body: [
          event.title,
          event.date,
          event.venue,
          event.description,
          event.url,
        ]
          .filter(Boolean)
          .join("\n\n"),
        mediaUrl: event.imageUrl || doc.heroImage,
        month: doc.month,
        monthKey: doc.monthKey,
        year: doc.year,
        language: doc.language,
        sourceCampaignId: doc.id,
        sourceEventId: event.id,
        mode: "draft",
      });
      created.push(saveVersioned("campaigns", social));
    }
    store.audit(user.id, "social.prepare", doc.id);
    return json({ ok: true, created });
  }
  const publication = path.match(/^\/api\/admin\/publications\/([a-f0-9-]+)$/);
  if (publication && request.method === "DELETE") {
    db.prepare("DELETE FROM publications WHERE id=?").run(publication[1]);
    store.audit(user.id, "agenda.unpublish", publication[1]);
    return json({ ok: true });
  }
}
