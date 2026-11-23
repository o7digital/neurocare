// Dedicated Neuro Diversa channel manager; UI contract follows suitesmine-bot/app/inbox.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { ServiceError } from "./providers.mjs";
const stamp = () => new Date().toISOString();
const text = (max = 200) => z.string().trim().max(max);
const idSchema = z.string().uuid();
export const defaultAutomation = {
  autoReply: true,
  humanHandoff: true,
  quickReplies: [
    "Hola, gracias por tu mensaje. ¿Cómo podemos ayudarte?",
    "Gracias. El equipo revisará la información y te responderá.",
  ],
};
export function threadMessages(db, id) {
  return db
    .prepare(
      "SELECT m.id,m.role,m.content,m.created,m.rowid AS sequence,f.id AS file_id,f.name AS file_name,f.size AS file_size,f.mime AS file_mime FROM messages m LEFT JOIN message_files mf ON mf.message_id=m.id LEFT JOIN channel_files f ON f.id=mf.file_id WHERE m.visitor_id=? ORDER BY m.rowid",
    )
    .all(id)
    .map(({ file_id, file_name, file_size, file_mime, ...message }) => ({
      ...message,
      ...(file_id
        ? {
            attachment: {
              id: file_id,
              name: file_name,
              size: file_size,
              mime: file_mime,
              url: `/api/widget/attachments/${file_id}`,
            },
          }
        : {}),
    }));
}
export function recordVisit(store, visitor, path, title = "") {
  if (!visitor.consent_at) return;
  const parsed = z
    .object({
      path: z
        .string()
        .max(1000)
        .regex(/^\/(?!\/)[^\s?#]*$/),
      title: text(240),
    })
    .safeParse({ path, title });
  if (!parsed.success) return;
  const last = store.db
    .prepare(
      "SELECT path,title,created FROM page_visits WHERE visitor_id=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(visitor.id);
  if (
    last?.path === path &&
    last.title === title &&
    Date.now() - Date.parse(last.created) < 60000
  )
    return;
  store.db
    .prepare("INSERT INTO page_visits VALUES (?,?,?,?,?)")
    .run(randomUUID(), visitor.id, path, title, stamp());
  store.db
    .prepare(
      "DELETE FROM page_visits WHERE visitor_id=? AND id NOT IN (SELECT id FROM page_visits WHERE visitor_id=? ORDER BY rowid DESC LIMIT 200)",
    )
    .run(visitor.id, visitor.id);
}
export function fileResponse(store, fileId, visitorId) {
  const row = store.db
    .prepare("SELECT * FROM channel_files WHERE id=?")
    .get(fileId);
  if (
    !row ||
    (visitorId && row.visitor_id !== visitorId) ||
    !store.db.prepare("SELECT 1 FROM message_files WHERE file_id=?").get(fileId)
  )
    throw new ServiceError(404, "Archivo no disponible.");
  return new Response(row.bytes, {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
const joins = `FROM visitors v LEFT JOIN leads l ON l.visitor_id=v.id LEFT JOIN channel_threads t ON t.visitor_id=v.id LEFT JOIN channel_profiles p ON p.visitor_id=v.id LEFT JOIN "user" u ON u.id=t.assignee_id`;
const hasConversation =
  "(EXISTS(SELECT 1 FROM messages WHERE visitor_id=v.id) OR l.id IS NOT NULL)";
function threadSelect(db, userId, where = "", params = []) {
  return db
    .prepare(
      `SELECT v.id,v.mode,v.language,v.page,v.consent_at,t.assignee_id,COALESCE(t.version,1) AS version,COALESCE(t.tags,'[]') AS tags,u.name AS assignee_name,COALESCE(NULLIF(p.name,''),NULLIF(trim(l.first_name||' '||l.last_name),''),'Visitante '||substr(v.id,1,8)) AS name,COALESCE(NULLIF(p.email,''),l.email,'') AS email,COALESCE(NULLIF(p.phone,''),l.phone,'') AS phone,l.id AS lead_id,l.interest,l.status AS lead_status,l.note AS followup_note,l.message AS lead_message,COALESCE((SELECT created FROM messages WHERE visitor_id=v.id ORDER BY rowid LIMIT 1),l.created) AS created,COALESCE((SELECT created FROM messages WHERE visitor_id=v.id ORDER BY rowid DESC LIMIT 1),l.updated) AS updated,COALESCE((SELECT content FROM messages WHERE visitor_id=v.id ORDER BY rowid DESC LIMIT 1),l.message,'') AS last_message,(SELECT COUNT(*) FROM messages WHERE visitor_id=v.id AND role='visitor' AND rowid>COALESCE((SELECT last_row FROM channel_reads WHERE visitor_id=v.id AND user_id=?),0)) AS unread ${joins} WHERE ${hasConversation} ${where}`,
    )
    .all(userId, ...params)
    .map((row) => ({
      ...row,
      tags: JSON.parse(row.tags),
      channel: "website",
      site: "neurodiversa",
      siteUrl: "https://neurodiversa.mx",
    }));
}
export async function channelRoute({
  path,
  url,
  request,
  body,
  user,
  store,
  providers,
  addMessage,
}) {
  if (!path.startsWith("/api/admin/channel/")) return;
  const { db } = store,
    json = (data) =>
      Response.json(data, { headers: { "Cache-Control": "no-store" } });
  if (path === "/api/admin/channel/settings") {
    if (request.method === "GET")
      return json({
        automation: store.get("oliviaAutomation", defaultAutomation),
        channels: {
          website: { connected: true },
          mailbox: { connected: false },
          whatsapp: { connected: false },
          facebook: { connected: false },
          instagram: { connected: false },
        },
      });
    if (request.method === "PUT") {
      if (user.role !== "owner")
        throw new ServiceError(
          403,
          "Solo la administración puede cambiar las automatizaciones.",
        );
      const data = z
        .object({
          autoReply: z.boolean(),
          humanHandoff: z.boolean(),
          quickReplies: z.array(text(1000).min(1)).min(1).max(12),
        })
        .parse(await body());
      store.set("oliviaAutomation", data);
      store.audit(user.id, "olivia.automation", "neurodiversa");
      return json({ ok: true });
    }
  }
  if (path === "/api/admin/channel/conversations" && request.method === "GET") {
    const all = threadSelect(db, user.id),
      q = (url.searchParams.get("q") || "").toLocaleLowerCase(),
      view = url.searchParams.get("view") || "open",
      offset = Math.max(0, Number(url.searchParams.get("offset")) || 0),
      limit = 50;
    const counts = {
      all: all.length,
      open: all.filter((c) => c.mode !== "closed").length,
      unassigned: all.filter((c) => c.mode !== "closed" && !c.assignee_id)
        .length,
      solved: all.filter((c) => c.mode === "closed").length,
      mine: all.filter((c) => c.mode !== "closed" && c.assignee_id === user.id)
        .length,
      unread: all.reduce((n, c) => n + c.unread, 0),
      ai: all.filter((c) => c.mode === "ai").length,
      manual: all.filter((c) => c.mode === "manual").length,
    };
    const filtered = all
      .filter(
        (c) =>
          (view === "all" ||
            (view === "open" && c.mode !== "closed") ||
            (view === "unassigned" && c.mode !== "closed" && !c.assignee_id) ||
            (view === "solved" && c.mode === "closed") ||
            (view === "mine" &&
              c.mode !== "closed" &&
              c.assignee_id === user.id)) &&
          `${c.name} ${c.email} ${c.phone} ${c.last_message} ${c.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(q),
      )
      .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
    return json({
      conversations: filtered.slice(offset, offset + limit),
      counts,
      total: filtered.length,
      nextOffset: offset + limit < filtered.length ? offset + limit : null,
      syncedAt: stamp(),
    });
  }
  const match = path.match(
    /^\/api\/admin\/channel\/conversations\/([a-f0-9-]+)(?:\/(status|read|tags|profile|notes|attachments|reply|suggestion))?$/,
  );
  if (!match) return;
  const id = idSchema.parse(match[1]),
    action = match[2];
  if (!db.prepare("SELECT id FROM visitors WHERE id=?").get(id))
    throw new ServiceError(404, "Conversación no encontrada.");
  db.prepare(
    "INSERT OR IGNORE INTO channel_threads(visitor_id) VALUES (?)",
  ).run(id);
  const thread = () =>
    db
      .prepare(
        "SELECT t.*,v.mode FROM channel_threads t JOIN visitors v ON v.id=t.visitor_id WHERE visitor_id=?",
      )
      .get(id);
  if (!action && request.method === "GET") {
    const conversation = threadSelect(db, user.id, "AND v.id=?", [id])[0];
    if (!conversation)
      throw new ServiceError(404, "Conversación no encontrada.");
    return json({
      conversation,
      messages: threadMessages(db, id),
      notes: db
        .prepare(
          'SELECT n.id,n.author_id,u.name AS author,n.content,n.created FROM channel_notes n LEFT JOIN "user" u ON u.id=n.author_id WHERE visitor_id=? ORDER BY n.rowid',
        )
        .all(id),
      pages: db
        .prepare(
          "SELECT id,path,title,created FROM page_visits WHERE visitor_id=? ORDER BY rowid DESC LIMIT 200",
        )
        .all(id),
    });
  }
  if (action === "read" && request.method === "POST") {
    const data = z
      .object({ unread: z.boolean().default(false) })
      .parse(await body());
    const last =
      db
        .prepare("SELECT max(rowid) AS id FROM messages WHERE visitor_id=?")
        .get(id).id || 0;
    db.prepare(
      "INSERT INTO channel_reads VALUES (?,?,?) ON CONFLICT(visitor_id,user_id) DO UPDATE SET last_row=excluded.last_row",
    ).run(id, user.id, data.unread ? 0 : last);
    return json({ ok: true });
  }
  if (action === "status" && request.method === "PATCH") {
    const data = z
      .object({
        mode: z.enum(["ai", "manual", "closed"]),
        version: z.number().int().positive(),
      })
      .parse(await body());
    db.transaction(() => {
      const current = thread();
      if (current.version !== data.version)
        throw new ServiceError(
          409,
          "Otra persona actualizó la conversación. Se ha recargado su estado.",
        );
      if (
        data.mode === "manual" &&
        current.assignee_id &&
        current.assignee_id !== user.id &&
        user.role !== "owner"
      )
        throw new ServiceError(
          409,
          "Otra persona del equipo está atendiendo esta conversación.",
        );
      db.prepare(
        "UPDATE channel_threads SET assignee_id=?,version=version+1 WHERE visitor_id=?",
      ).run(
        data.mode === "manual"
          ? user.id
          : data.mode === "ai"
            ? null
            : current.assignee_id,
        id,
      );
      db.prepare("UPDATE visitors SET mode=? WHERE id=?").run(data.mode, id);
      store.audit(user.id, `channel.${data.mode}`, id);
    })();
    return json({ ok: true });
  }
  if (action === "tags" && request.method === "PATCH") {
    const data = z
      .object({
        tags: z.array(text(40).min(1)).max(20),
        version: z.number().int().positive(),
      })
      .parse(await body());
    const tags = [...new Set(data.tags)];
    if (
      !db
        .prepare(
          "UPDATE channel_threads SET tags=?,version=version+1 WHERE visitor_id=? AND version=?",
        )
        .run(JSON.stringify(tags), id, data.version).changes
    )
      throw new ServiceError(
        409,
        "Las etiquetas cambiaron. Recarga la conversación.",
      );
    store.audit(user.id, "channel.tags", id);
    return json({ ok: true });
  }
  if (action === "profile" && request.method === "PATCH") {
    const data = z
      .object({
        name: text(200).min(1),
        email: z.union([z.email().max(240), z.literal("")]),
        phone: text(40),
      })
      .parse(await body());
    db.prepare(
      "INSERT INTO channel_profiles VALUES (?,?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone",
    ).run(id, data.name, data.email, data.phone);
    store.audit(user.id, "channel.profile", id);
    return json({ ok: true });
  }
  if (action === "notes" && request.method === "POST") {
    const data = z
      .object({ id: idSchema, content: text(4000).min(1) })
      .parse(await body());
    const existing = db
      .prepare(
        "SELECT visitor_id,author_id,content FROM channel_notes WHERE id=?",
      )
      .get(data.id);
    if (
      existing &&
      (existing.visitor_id !== id ||
        existing.author_id !== user.id ||
        existing.content !== data.content)
    )
      throw new ServiceError(409, "Identificador de nota ya utilizado.");
    db.prepare("INSERT OR IGNORE INTO channel_notes VALUES (?,?,?,?,?)").run(
      data.id,
      id,
      user.id,
      data.content,
      stamp(),
    );
    store.audit(user.id, "channel.note", id);
    return json({ ok: true });
  }
  if (action === "attachments" && request.method === "POST") {
    if (!store.limit(`files:${user.id}`, 30, 3600))
      throw new ServiceError(429, "Límite de archivos por hora alcanzado.");
    const data = z
      .object({ name: text(160).min(1), base64: z.string().max(2800000) })
      .parse(await body());
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))
      throw new ServiceError(400, "Archivo inválido.");
    let bytes = Buffer.from(data.base64, "base64"),
      mime = "",
      name = data.name.replace(/[\r\n/\\]/g, "-");
    if (bytes.length > 2000000)
      throw new ServiceError(413, "El archivo supera los 2 MB.");
    if (/\.pdf$/i.test(name) && bytes.subarray(0, 5).toString() === "%PDF-")
      mime = "application/pdf";
    else if (/\.txt$/i.test(name) && bytes.length <= 200000) {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (bytes.includes(0)) throw new Error();
        mime = "text/plain; charset=utf-8";
      } catch {}
    } else if (/\.(jpe?g|png|webp)$/i.test(name)) {
      try {
        const img = sharp(bytes, { limitInputPixels: 16000000 });
        if (!["jpeg", "png", "webp"].includes((await img.metadata()).format))
          throw new Error();
        bytes = await img
          .rotate()
          .resize({
            width: 1800,
            height: 1800,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 87 })
          .toBuffer();
        mime = "image/jpeg";
        name = name.replace(/\.[^.]+$/, ".jpg");
      } catch {}
    }
    if (!mime)
      throw new ServiceError(400, "Usa un PDF, JPG, PNG, WebP o TXT válido.");
    const fileId = randomUUID();
    db.prepare("INSERT INTO channel_files VALUES (?,?,?,?,?,?,?,?)").run(
      fileId,
      id,
      user.id,
      name,
      mime,
      bytes.length,
      bytes,
      stamp(),
    );
    return json({ id: fileId, name, mime, size: bytes.length });
  }
  if (action === "reply" && request.method === "POST") {
    const data = z
      .object({
        content: text(4000),
        attachmentId: idSchema.optional(),
        requestId: idSchema,
      })
      .parse(await body());
    if (!data.content && !data.attachmentId)
      throw new ServiceError(400, "Escribe una respuesta o añade un archivo.");
    const duplicate = db
      .prepare("SELECT id,visitor_id,content FROM messages WHERE request_id=?")
      .get(data.requestId);
    if (duplicate) {
      if (duplicate.visitor_id !== id || duplicate.content !== data.content)
        throw new ServiceError(409, "Esta solicitud ya se utilizó.");
      return json({ ok: true, duplicate: true });
    }
    db.transaction(() => {
      const current = thread();
      if (current.mode !== "manual" || current.assignee_id !== user.id)
        throw new ServiceError(
          409,
          "Toma el control de la conversación antes de responder.",
        );
      if (
        data.attachmentId &&
        !db
          .prepare(
            "SELECT id FROM channel_files WHERE id=? AND visitor_id=? AND author_id=?",
          )
          .get(data.attachmentId, id, user.id)
      )
        throw new ServiceError(
          400,
          "Este archivo no pertenece a la conversación.",
        );
      const message = addMessage(id, "operator", data.content, data.requestId);
      if (data.attachmentId)
        db.prepare("INSERT INTO message_files VALUES (?,?)").run(
          message.id,
          data.attachmentId,
        );
      store.audit(user.id, "channel.reply", id);
    })();
    return json({ ok: true });
  }
  if (action === "suggestion" && request.method === "POST") {
    const data = z
      .object({
        language: z.enum(["fr", "en", "es"]),
        task: z.enum(["reply", "summary"]).default("reply"),
      })
      .parse(await body());
    if (!store.limit(`assist:${user.id}`, 10, 3600))
      throw new ServiceError(
        429,
        "Límite de propuestas IA por hora alcanzado.",
      );
    const transcript = threadMessages(db, id)
      .slice(-12)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(-12000);
    if (!transcript)
      throw new ServiceError(400, "Todavía no hay mensajes para analizar.");
    const result = await providers.assist(transcript, data.language, data.task);
    store.audit(user.id, `channel.assist.${data.task}`, id);
    return json({ text: result.text, version: "3.6.0" });
  }
  throw new ServiceError(405, "Método no permitido.");
}
