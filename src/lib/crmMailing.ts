/** Adapted from o7digital/crm-suites-o7, commit a353f69897e8a09b8cc95141fcb46404ad35043c.
 * Source: frontend/src/app/admin/mail/page.tsx.
 * Only reusable template logic is included; no CRM runtime, contacts, secrets or network calls.
 */
export type CampaignEvent = {
  id: string;
  category: string;
  title: string;
  date: string;
  venue: string;
  description: string;
  url: string;
  sourceLabel: string;
  imageUrl?: string;
};
export type NewsletterCampaign = {
  fromName?: string;
  id: string;
  month: string;
  subject: string;
  preheader: string;
  headline: string;
  eyebrow: string;
  heroImage: string;
  body: string;
  cta: string;
  ctaUrl: string;
  highlights: string[];
  events: CampaignEvent[];
  status: "DRAFT" | "SAVED";
  updated: string;
};
export type MailchimpSetup = {
  fromName: string;
  heroImage: string;
  reservationUrl: string;
  websiteUrl: string;
  address: string;
  phone: string;
  gallery: string[];
};
export function safeWebUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      ? url.toString()
      : "https://neurodiversa.mx/";
  } catch {
    return "https://neurodiversa.mx/";
  }
}
export function buildMailchimpHtml(
  campaign: NewsletterCampaign,
  setup: MailchimpSetup,
) {
  const brandName = setup.fromName || "Neuro Diversa";
  const heroImage = campaign.heroImage || setup.heroImage;
  const richContent = styleEmailRichHtml(
    sanitizeRichHtml(toMailchimpText(paragraphsToRichHtml(campaign.body))),
  );
  const highlights = campaign.highlights
    .map(
      (item) =>
        `<div style="margin:0 0 10px;border:1px solid #e3cfd4;background:#fff8f3;padding:13px;border-radius:7px;color:#67505e;font-size:14px;line-height:1.5;">${escapeHtml(item)}</div>`,
    )
    .join("");
  const events = campaign.events
    .map(
      (event) =>
        `<tr><td style="padding:8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e3cfd4;background:#f6ecee;border-radius:8px;">${event.imageUrl ? `<tr><td><img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.title)}" width="612" style="display:block;width:100%;height:auto;border:0;border-radius:8px 8px 0 0;" /></td></tr>` : ""}<tr><td style="padding:20px;"><div style="color:#965769;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(event.category)} · ${escapeHtml(event.date)}</div><h3 style="margin:10px 0 5px;font-family:Georgia,serif;font-size:22px;color:#553546;">${escapeHtml(event.title)}</h3><div style="color:#78656d;font-size:12px;font-weight:700;">${escapeHtml(event.venue)}</div><p style="margin:12px 0;color:#715e68;font-size:14px;line-height:1.6;">${escapeHtml(event.description)}</p>${event.url ? `<a href="${escapeHtml(safeWebUrl(event.url))}" style="color:#87424d;font-size:12px;font-weight:700;">Verificar en ${escapeHtml(event.sourceLabel || "sitio oficial")}</a>` : ""}</td></tr></table></td></tr>`,
    )
    .join("");
  const gallery = setup.gallery
    .slice(0, 4)
    .map(
      (image) =>
        `<td width="25%" style="padding:4px;"><img src="${escapeHtml(image)}" alt="Imagen" width="145" style="display:block;width:100%;height:auto;border:0;border-radius:7px;" /></td>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(campaign.subject)}</title>
  <style>@media only screen and (max-width:620px){.email-shell{width:100%!important}.stack{display:block!important;width:100%!important}.hero-title{font-size:34px!important}.pad{padding-left:22px!important;padding-right:22px!important}}</style>
</head>
<body style="margin:0;background:#f3e9e8;font-family:Arial,Helvetica,sans-serif;color:#402b35;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(campaign.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3e9e8;padding:26px 10px;"><tr><td align="center">
    <table class="email-shell" role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;width:100%;background:#fffdf9;border:1px solid #e3cfd4;border-radius:10px;overflow:hidden;">
      <tr><td class="stack pad" width="50%" valign="middle" style="padding:36px 32px;"><div style="color:#965769;font-size:11px;text-transform:uppercase;letter-spacing:3px;">${escapeHtml(brandName)}</div><h1 class="hero-title" style="margin:22px 0 18px;font-family:Georgia,serif;font-size:42px;line-height:1.08;color:#553546;">${escapeHtml(campaign.headline)}</h1><p style="margin:0;color:#78656d;font-size:15px;line-height:1.7;">${escapeHtml(campaign.preheader)}</p></td><td class="stack" width="50%" valign="middle">${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="Imagen del boletín" width="340" style="display:block;width:100%;height:auto;border:0;" />` : ""}</td></tr>
      <tr><td colspan="2" style="background:#402b35;color:#fff8f3;padding:24px 32px;"><div style="font-family:Georgia,serif;font-size:28px;font-weight:700;">${escapeHtml(brandName)}</div><div style="margin-top:7px;color:#e5cbd7;font-size:11px;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(campaign.eyebrow)}</div></td></tr>
      <tr><td class="stack pad" width="67%" valign="top" style="padding:34px;"><div style="color:#965769;font-size:11px;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(campaign.month)}</div><h2 style="margin:12px 0 24px;font-family:Georgia,serif;font-size:30px;line-height:1.2;color:#553546;">${escapeHtml(campaign.subject)}</h2>${richContent}<a href="${escapeHtml(safeWebUrl(campaign.ctaUrl || setup.reservationUrl))}" style="display:inline-block;margin-top:8px;background:#87424d;color:#fff;text-decoration:none;padding:14px 22px;border-radius:7px;font-weight:700;font-size:14px;">${escapeHtml(campaign.cta)}</a></td><td class="stack pad" width="33%" valign="top" style="background:#eee5ed;padding:34px 22px;"><div style="margin-bottom:15px;color:#965769;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Incluye</div>${highlights}</td></tr>
      <tr><td colspan="2" class="pad" style="border-top:1px solid #e8d7db;background:#fffdf8;padding:34px;"><div style="color:#965769;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Contenidos relacionados</div><h2 style="margin:10px 0 20px;font-family:Georgia,serif;font-size:28px;color:#553546;">Para descubrir</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${events}</table></td></tr>
      <tr><td colspan="2" class="pad" style="border-top:1px solid #e8d7db;background:#f4e9ed;padding:28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${gallery}</tr></table></td></tr>
      <tr><td colspan="2" class="pad" style="background:#402b35;color:#fff8f3;padding:25px 32px;font-size:13px;line-height:1.7;"><strong>${escapeHtml(brandName)}</strong><br />${escapeHtml(setup.address)}<br />${escapeHtml(setup.phone)} · <a href="${escapeHtml(safeWebUrl(setup.websiteUrl))}" style="color:#edcad7;">${escapeHtml(safeWebUrl(setup.websiteUrl))}</a><br /><span style="color:#e5cbd7;">*|HTML:LIST_ADDRESS_HTML|* · <a href="*|UNSUB|*" style="color:#e5cbd7;">Cancelar suscripción</a></span></td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

export function toMailchimpText(value: string) {
  return value
    .replace(/\{\{\s*firstName\s*\}\}/g, "*|FNAME|*")
    .replace(/\{\{\s*fullName\s*\}\}/g, "*|FNAME|* *|LNAME|*")
    .replace(/\{\{\s*company\s*\}\}/g, "*|COMPANY|*")
    .replace(/\{\{\s*email\s*\}\}/g, "*|EMAIL|*");
}

export function paragraphsToRichHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

export function sanitizeRichHtml(raw: string) {
  const allowed = new Set([
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
  ]);
  const withoutDangerousBlocks = raw
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "");

  return withoutDangerousBlocks.replace(
    /<\/?([a-z0-9]+)([^>]*)>/gi,
    (match, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowed.has(tag)) return "";
      if (match.startsWith("</")) return tag === "br" ? "" : `</${tag}>`;
      if (tag === "br") return "<br />";
      if (tag !== "a") return `<${tag}>`;

      const hrefMatch = rawAttributes.match(/href\s*=\s*["']([^"']+)["']/i);
      const href = hrefMatch?.[1]?.trim() || "";
      if (!/^(https?:\/\/|mailto:)/i.test(href)) return "<a>";
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">`;
    },
  );
}

export function styleEmailRichHtml(value: string) {
  return value
    .replaceAll(
      "<p>",
      '<p style="margin:0 0 18px;color:#715e68;font-size:15px;line-height:1.75;">',
    )
    .replaceAll(
      "<h2>",
      '<h2 style="margin:24px 0 12px;font-family:Georgia,serif;font-size:24px;color:#553546;">',
    )
    .replaceAll(
      "<h3>",
      '<h3 style="margin:20px 0 10px;font-family:Georgia,serif;font-size:19px;color:#553546;">',
    )
    .replaceAll(
      "<ul>",
      '<ul style="margin:0 0 18px;padding-left:24px;color:#715e68;font-size:15px;line-height:1.75;">',
    )
    .replaceAll(
      "<ol>",
      '<ol style="margin:0 0 18px;padding-left:24px;color:#715e68;font-size:15px;line-height:1.75;">',
    )
    .replaceAll(
      "<blockquote>",
      '<blockquote style="margin:20px 0;padding:12px 18px;border-left:3px solid #965769;background:#f6ecee;color:#715e68;">',
    )
    .replace(
      /<a href="([^"]+)" target="_blank" rel="noreferrer">/g,
      '<a href="$1" style="color:#87424d;text-decoration:underline;">',
    );
}

export function previewMergeTags(value: string) {
  return value
    .replace(/\{\{\s*firstName\s*\}\}/g, "María")
    .replace(/\{\{\s*fullName\s*\}\}/g, "María García")
    .replace(/\{\{\s*company\s*\}\}/g, "tu empresa")
    .replace(/\{\{\s*email\s*\}\}/g, "maria@ejemplo.com");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
