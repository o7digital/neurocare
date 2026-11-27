import {
  mkdir,
  appendFile,
  readFile,
  unlink,
  readdir,
  stat,
  open,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ServiceError } from "./providers.mjs";
const locks = new Map();
export async function siteVideoRoute({
  path,
  request,
  body,
  user,
  store,
  cms,
  env,
}) {
  if (
    !path.startsWith("/api/admin/site/video-upload") ||
    request.method !== "POST"
  )
    return;
  const root = env.SITE_UPLOAD_DIR || "/data/site-video-uploads";
  const json = (value) =>
    Response.json(value, { headers: { "Cache-Control": "no-store" } });
  if (path === "/api/admin/site/video-upload") {
    const input = z
      .object({
        name: z.string().min(1).max(160),
        mime: z.enum(["video/mp4", "video/webm"]),
        size: z
          .number()
          .int()
          .min(16)
          .max(50 * 1024 * 1024),
      })
      .parse(await body());
    if (!store.limit(`site-video:${user.id}`, 10, 3600))
      throw new ServiceError(429, "Límite de vídeos por hora alcanzado.");
    await mkdir(root, { recursive: true, mode: 0o700 });
    for (const file of await readdir(root)) {
      if (
        /^[a-f0-9-]{36}$/.test(file) &&
        Date.now() - (await stat(join(root, file))).mtimeMs > 86400000
      )
        await unlink(join(root, file)).catch(() => {});
    }
    const id = randomUUID();
    await appendFile(join(root, id), Buffer.alloc(0), {
      mode: 0o600,
      flag: "wx",
    });
    store.set(`site-video:${id}`, {
      ...input,
      user: user.id,
      received: 0,
      expires: Date.now() + 3600000,
    });
    return json({ id });
  }
  const input = z
    .object({
      id: z.string().uuid(),
      offset: z.number().int().nonnegative().optional(),
      base64: z.string().max(1400000).optional(),
    })
    .parse(await body());
  const previous = locks.get(input.id) || Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(async () => {
      const key = `site-video:${input.id}`,
        upload = store.get(key);
      if (!upload || upload.user !== user.id || upload.expires < Date.now())
        throw new ServiceError(
          404,
          "La importación de vídeo caducó. Vuelve a seleccionar el archivo.",
        );
      const file = join(root, input.id);
      if (path === "/api/admin/site/video-upload-chunk") {
        if (input.offset === undefined || !input.base64 || upload.result)
          throw new ServiceError(400, "Fragmento de vídeo inválido.");
        const bytes = Buffer.from(input.base64, "base64");
        if (
          !bytes.length ||
          bytes.length > 1024 * 1024 ||
          input.offset + bytes.length > upload.size
        )
          throw new ServiceError(400, "Tamaño de vídeo inválido.");
        if (input.offset < upload.received) {
          const handle = await open(file, "r");
          try {
            const existing = Buffer.alloc(bytes.length);
            await handle.read(existing, 0, bytes.length, input.offset);
            if (!existing.equals(bytes))
              throw new ServiceError(409, "Vuelve a importar el vídeo.");
          } finally {
            await handle.close();
          }
          return json({ received: upload.received });
        }
        if (input.offset !== upload.received)
          throw new ServiceError(409, "Falta un fragmento del vídeo.");
        await appendFile(file, bytes);
        upload.received += bytes.length;
        store.set(key, upload);
        return json({ received: upload.received });
      }
      if (path === "/api/admin/site/video-upload-finish") {
        if (upload.result) return json(upload.result);
        if (upload.received !== upload.size)
          throw new ServiceError(400, "El vídeo todavía no terminó de subir.");
        const bytes = await readFile(file);
        const valid =
          upload.mime === "video/mp4"
            ? bytes.subarray(4, 8).toString() === "ftyp"
            : bytes
                .subarray(0, 4)
                .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
        if (!valid) {
          await unlink(file);
          throw new ServiceError(
            400,
            "Selecciona un archivo MP4 o WebM válido.",
          );
        }
        const result = await cms.uploadVideo({
          name: upload.name,
          mime: upload.mime,
          bytes,
        });
        store.set(key, { ...upload, result });
        await unlink(file);
        return json(result);
      }
      throw new ServiceError(404, "Ruta no disponible.");
    });
  locks.set(input.id, task);
  try {
    return await task;
  } finally {
    if (locks.get(input.id) === task) locks.delete(input.id);
  }
}
