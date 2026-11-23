// Shared production renderer ported from crm-suitesmine dev bfd0ce3, admin/mail/page.tsx.
// Pure rendering only: safe to bundle for admin previews; no runtime secrets or IO.
import sanitizeHtml from "sanitize-html";
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function sanitizeRichHtml(raw) {
  return sanitizeHtml(String(raw || ""), {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "code",
      "pre",
    ],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noreferrer noopener",
      }),
    },
  });
}
export function paragraphsToRichHtml(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replaceAll("\n", "<br>")}</p>`)
    .join("");
}
export function previewMergeTags(value) {
  return value
    .replace(/\{\{\s*firstName\s*\}\}/g, "María")
    .replace(/\{\{\s*fullName\s*\}\}/g, "María García")
    .replace(/\{\{\s*email\s*\}\}/g, "maria@example.test")
    .replace(/\{\{\s*company\s*\}\}/g, "");
}
export function toMailchimpText(value) {
  return value
    .replace(/\{\{\s*firstName\s*\}\}/g, "*|FNAME|*")
    .replace(/\{\{\s*fullName\s*\}\}/g, "*|FNAME|* *|LNAME|*")
    .replace(/\{\{\s*email\s*\}\}/g, "*|EMAIL|*")
    .replace(/\{\{\s*company\s*\}\}/g, "*|COMPANY|*");
}
function styleEmailRichHtml(value) {
  return value
    .replaceAll(
      "<p>",
      '<p style="margin:0 0 18px;color:#4c453b;font-size:15px;line-height:1.75;">',
    )
    .replaceAll(
      "<h2>",
      '<h2 style="margin:24px 0 12px;font-family:Georgia,serif;font-size:24px;color:#402b35;">',
    )
    .replaceAll(
      "<h3>",
      '<h3 style="margin:20px 0 10px;font-family:Georgia,serif;font-size:19px;color:#402b35;">',
    )
    .replaceAll(
      "<ul>",
      '<ul style="margin:0 0 18px;padding-left:24px;color:#4c453b;font-size:15px;line-height:1.75;">',
    )
    .replaceAll(
      "<ol>",
      '<ol style="margin:0 0 18px;padding-left:24px;color:#4c453b;font-size:15px;line-height:1.75;">',
    )
    .replaceAll(
      "<blockquote>",
      '<blockquote style="margin:20px 0;padding:12px 18px;border-left:3px solid #a77f39;background:#f8f0e2;color:#5b5247;">',
    )
    .replace(
      /<a href="([^"]+)" target="_blank" rel="noreferrer">/g,
      '<a href="$1" style="color:#87424d;text-decoration:underline;">',
    );
}

export function buildNewsletterHtml(campaign, setup) {
  const richContent = styleEmailRichHtml(
    sanitizeRichHtml(campaign.bodyHtml || paragraphsToRichHtml(campaign.body)),
  );
  const highlights = campaign.highlights
    .map(
      (item) =>
        `<div style="margin:0 0 10px;border:1px solid #d8c8ad;background:#fffaf0;padding:13px;border-radius:7px;color:#3d382f;font-size:14px;line-height:1.5;">${escapeHtml(item)}</div>`,
    )
    .join("");
  const events = campaign.events
    .map(
      (event) =>
        `<tr><td style="padding:8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #ded1bc;background:#f8f0e2;border-radius:8px;">${event.imageUrl ? `<tr><td><img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.title)}" width="612" style="display:block;width:100%;height:auto;border:0;border-radius:8px 8px 0 0;" /></td></tr>` : ""}<tr><td style="padding:20px;"><div style="color:#98743a;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(event.category)} · ${escapeHtml(event.date)}</div><h3 style="margin:10px 0 5px;font-family:Georgia,serif;font-size:22px;color:#402b35;">${escapeHtml(event.title)}</h3><div style="color:#6b5d49;font-size:12px;font-weight:700;">${escapeHtml(event.venue)}</div><p style="margin:12px 0;color:#5b5247;font-size:14px;line-height:1.6;">${escapeHtml(event.description)}</p>${event.url ? `<a href="${escapeHtml(event.url)}" style="color:#87424d;font-size:12px;font-weight:700;">Más información en ${escapeHtml(event.sourceLabel || "sitio oficial")}</a>` : ""}</td></tr></table></td></tr>`,
    )
    .join("");
  const gallery = setup.gallery
    .slice(0, 4)
    .map(
      (image) =>
        `<td width="25%" style="padding:4px;"><img src="${escapeHtml(image)}" alt="Neuro Diversa" width="145" style="display:block;width:100%;height:auto;border:0;border-radius:7px;" /></td>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${escapeHtml(campaign.language || "es")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(campaign.subject)}</title>
  <style>@media only screen and (max-width:620px){.email-shell{width:100%!important}.stack{display:block!important;width:100%!important}.hero-title{font-size:34px!important}.pad{padding-left:22px!important;padding-right:22px!important}}</style>
</head>
<body style="margin:0;background:#efe7d8;font-family:Arial,Helvetica,sans-serif;color:#1d1a16;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(campaign.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#efe7d8;padding:26px 10px;"><tr><td align="center">
    <table class="email-shell" role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;width:100%;background:#fbf8f1;border:1px solid #d6c8ad;border-radius:10px;overflow:hidden;">
      <tr><td class="stack pad" width="50%" valign="middle" style="padding:36px 32px;"><div style="color:#9a6678;font-size:11px;text-transform:uppercase;letter-spacing:3px;">Neuro Diversa</div><h1 class="hero-title" style="margin:22px 0 18px;font-family:Georgia,serif;font-size:42px;line-height:1.08;color:#402b35;">${escapeHtml(campaign.headline)}</h1><p style="margin:0;color:#716554;font-size:15px;line-height:1.7;">${escapeHtml(campaign.preheader)}</p></td><td class="stack" width="50%" valign="middle"><img src="${escapeHtml(campaign.heroImage || setup.heroImage)}" alt="Neuro Diversa" width="340" style="display:block;width:100%;height:auto;border:0;" /></td></tr>
      <tr><td colspan="2" style="background:#402b35;color:#f4ead7;padding:24px 32px;"><div style="font-family:Georgia,serif;font-size:28px;font-weight:700;">Neuro Diversa</div><div style="margin-top:7px;color:#d7c6a3;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Psiquiatría y psicología · San Ángel · ${escapeHtml(campaign.eyebrow)}</div></td></tr>
      <tr><td class="stack pad" width="67%" valign="top" style="padding:34px;"><div style="color:#9a6678;font-size:11px;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(campaign.month)}</div><h2 style="margin:12px 0 24px;font-family:Georgia,serif;font-size:30px;line-height:1.2;color:#402b35;">${escapeHtml(campaign.subject)}</h2>${richContent}<a href="${escapeHtml(campaign.ctaUrl || setup.reservationUrl)}" style="display:inline-block;margin-top:8px;background:#87424d;color:#fff;text-decoration:none;padding:14px 22px;border-radius:7px;font-weight:700;font-size:14px;">${escapeHtml(campaign.cta)}</a></td><td class="stack pad" width="33%" valign="top" style="background:#f3ead9;padding:34px 22px;"><div style="margin-bottom:15px;color:#9a6678;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Incluye</div>${highlights}</td></tr>
      <tr><td colspan="2" class="pad" style="border-top:1px solid #e3d7c3;background:#fffdf8;padding:34px;"><div style="color:#9a6678;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Actividades y recursos</div><h2 style="margin:10px 0 20px;font-family:Georgia,serif;font-size:28px;color:#402b35;">Actividades de ${escapeHtml(campaign.month.toLowerCase())}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${events}</table></td></tr>
      <tr><td colspan="2" class="pad" style="border-top:1px solid #e3d7c3;background:#f7f0e4;padding:28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${gallery}</tr></table></td></tr>
      <tr><td colspan="2" class="pad" style="background:#402b35;color:#f4ead7;padding:25px 32px;font-size:13px;line-height:1.7;"><strong>Neuro Diversa</strong><br />${escapeHtml(setup.address)}<br />${escapeHtml(setup.phone)} · <a href="${escapeHtml(setup.websiteUrl)}" style="color:#e6c77d;">${escapeHtml(setup.websiteUrl)}</a><br /><span style="color:#d7c6a3;">*|HTML:LIST_ADDRESS_HTML|* · <a href="*|UNSUB|*" style="color:#d7c6a3;">Cancelar suscripción</a></span></td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}
