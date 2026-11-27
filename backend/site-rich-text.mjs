// Shared by the visual editor and both public/private renderers. Existing values
// remain plain text with a small, attribute-free formatting vocabulary.
export const escapeText = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function safeTextLink(value) {
  return /^(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+@[^\s<>"']+|\/(?!\/)[^\s<>"']*|#[a-zA-Z0-9_-]+)$/.test(
    String(value),
  );
}

export function richTextHtml(value) {
  return escapeText(value)
    .replace(
      /&lt;(\/?(?:em|strong|u|s|p|h2|h3|ul|ol|li|a|span)|br\s*\/?)&gt;/gi,
      "<$1>",
    )
    .replace(
      /&lt;span data-(size|font)=&quot;(12|14|16|18|20|24|32|40|48|64|sans|serif|georgia)&quot;&gt;/g,
      '<span data-$1="$2">',
    )
    .replace(/&lt;a href=&quot;([^<>]*?)&quot;&gt;/gi, (match, href) =>
      safeTextLink(href) ? `<a href="${href}">` : match,
    );
}

export const richTextStyles =
  "nd-edit p{font:inherit;color:inherit;margin:0 0 1em}nd-edit h2,nd-edit h3{font-family:inherit;color:inherit;line-height:1.3;margin:1.2em 0 .5em}nd-edit h2{font-size:1.4em}nd-edit h3{font-size:1.2em}nd-edit ul,nd-edit ol{margin:.75em 0;padding-left:1.6em;list-style-position:outside}nd-edit ul{list-style-type:disc}nd-edit ol{list-style-type:decimal}nd-edit li{display:list-item;margin:.3em 0}nd-edit a{text-decoration:underline}" +
  [12, 14, 16, 18, 20, 24, 32, 40, 48, 64]
    .map((size) => `[data-size="${size}"]{font-size:${size}px}`)
    .join("") +
  '[data-font="sans"]{font-family:Arial,sans-serif}[data-font="serif"],[data-font="georgia"]{font-family:Georgia,serif}';
