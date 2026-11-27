import { escapeText as esc, richTextHtml } from "./site-rich-text.mjs";
const fonts = {
  site: "inherit",
  sans: "Arial, sans-serif",
  serif: "Georgia, serif",
  georgia: "Georgia, serif",
};
export function mediaUrl(value, preview = false) {
  if (/^cms:[a-f0-9-]{36}$/.test(value || ""))
    return `${preview ? "/api/admin/site/asset/" : "/api/public/site-image/"}${value.slice(4)}`;
  return /^(https:\/\/[^\s<>"']+|\/(?!\/)[^\s<>"']*)$/.test(value || "")
    ? value
    : "";
}
export function videoEmbed(value) {
  try {
    const url = new URL(value);
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "www.youtube-nocookie.com",
      ].includes(url.hostname)
    ) {
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.slice(1)
          : url.searchParams.get("v") || url.pathname.split("/").at(-1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id || "")
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : "";
    }
    if (
      ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)
    ) {
      const id = url.pathname.split("/").at(-1);
      return /^\d+$/.test(id || "")
        ? `https://player.vimeo.com/video/${id}`
        : "";
    }
  } catch {}
  return "";
}
export function renderSiteBlock(block, { preview = false } = {}) {
  const attrs = `class="nd-page-block" data-site-block="${esc(block.id)}"`;
  if (block.type === "columns") {
    const count = block.columns === 3 ? 3 : 2;
    return `<div ${attrs} style="--nd-columns:${count}"><div class="nd-block-columns">${Array.from({ length: count }, (_, i) => `<div class="nd-block-column">${(block.children?.[i] || []).map((child) => renderSiteBlock(child, { preview })).join("")}</div>`).join("")}</div></div>`;
  }
  if (block.type === "text") {
    const size = Math.max(12, Math.min(72, Number(block.size) || 18));
    const font = fonts[block.font] || fonts.site;
    const align = ["left", "center", "right"].includes(block.align)
      ? block.align
      : "left";
    const marker = preview
      ? ` data-studio-text="${esc(JSON.stringify({ key: `block:${block.id}` }))}"`
      : "";
    return `<div ${attrs} style="font-size:${size}px;font-family:${font};text-align:${align};line-height:1.7"><nd-edit${marker}>${richTextHtml(block.html || "")}</nd-edit></div>`;
  }
  const src = mediaUrl(block.src, preview);
  const caption = block.caption
    ? `<figcaption>${esc(block.caption)}</figcaption>`
    : "";
  if (!src)
    return preview
      ? `<div ${attrs}><p>Añade ${block.type === "video" ? "un vídeo" : "una fotografía"} desde Bloques y columnas.</p></div>`
      : "";
  if (block.type === "image") {
    const marker = preview
      ? ` data-studio-image="${esc(JSON.stringify({ collection: "block", id: block.id }))}"`
      : "";
    return `<figure ${attrs}><img${marker} src="${esc(src)}" alt="${esc(block.alt || "")}" width="1200" height="800" loading="${preview ? "eager" : "lazy"}">${caption}</figure>`;
  }
  const embed = videoEmbed(block.src);
  const video = embed
    ? preview
      ? `<a class="nd-video-placeholder" href="${esc(block.src)}">▶ Vídeo · ${esc(block.caption || "YouTube / Vimeo")}</a>`
      : `<iframe src="${esc(embed)}" title="${esc(block.caption || "Vídeo")}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : `<video src="${esc(src)}" controls preload="metadata" playsinline aria-label="${esc(block.caption || "Vídeo")}"></video>`;
  return `<figure ${attrs}>${video}${caption}</figure>`;
}
export const siteBlockStyles =
  ".nd-page-block{box-sizing:border-box;margin:1.5rem auto;width:100%;max-width:1200px;padding:0 1.5rem}.nd-page-block .nd-page-block{padding:0;margin:0 0 1.5rem}.nd-block-columns{display:grid;grid-template-columns:repeat(var(--nd-columns,2),minmax(0,1fr));gap:2rem}.nd-block-column{min-width:0}.nd-page-block img,.nd-page-block video,.nd-page-block iframe{display:block;width:100%;max-width:100%;border:0;border-radius:10px}.nd-page-block img{height:auto}.nd-page-block iframe,.nd-video-placeholder{aspect-ratio:16/9}.nd-video-placeholder{display:grid;place-items:center;background:#f2e9ed;border-radius:10px;color:#87424d}.nd-page-block figcaption{font:14px/1.6 Arial,sans-serif;color:#6b6470;margin-top:.6rem}.nd-page-block nd-edit{display:block;overflow-wrap:anywhere}@media(max-width:700px){.nd-block-columns{grid-template-columns:1fr;gap:1rem}.nd-page-block{padding:0 1rem}}";
