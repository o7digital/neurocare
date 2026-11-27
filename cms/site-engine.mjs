// Visual-page pipeline follows Nathalie Studio's parse5 companion-document approach.
import { parse, parseFragment, serialize } from "parse5";
import { createHash } from "node:crypto";
import { richTextHtml, richTextStyles } from "./site-rich-text.mjs";
import { renderSiteBlock, siteBlockStyles } from "./site-blocks.mjs";
export const digest = (value) =>
  createHash("sha256").update(String(value)).digest("hex");
export const documentId = (path) => `page-${digest(path).slice(0, 24)}`;
export const canonicalPath = (value) => {
  const path = String(value || "/").split("?")[0];
  if (
    !/^\/(?:[a-zA-Z0-9-]+\/)*[a-zA-Z0-9-]*\/?$/.test(path) ||
    path.length > 300
  )
    throw new Error("Invalid website path");
  return path === "/" ? path : path.replace(/\/?$/, "/");
};
export const attr = (node, name) =>
  node.attrs?.find((a) => a.name === name)?.value;
export function setAttr(node, name, value) {
  node.attrs ??= [];
  const current = node.attrs.find((a) => a.name === name);
  if (current) current.value = String(value);
  else node.attrs.push({ name, value: String(value) });
}
const norm = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
const textOf = (node) =>
  node.nodeName === "#text"
    ? node.value
    : (node.childNodes || []).map(textOf).join("");
const ignored = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "template",
  "iframe",
  "code",
  "pre",
]);
export function makeBundle(html, path) {
  path = canonicalPath(path);
  const doc = parse(html),
    locale = path.startsWith("/en/") ? "en" : "es",
    pageId = documentId(path),
    fields = [],
    sections = new Map();
  let title = "",
    description = "";
  const visit = (node, trail = "", section = "page", heading = "") => {
    if (
      ignored.has(node.tagName) ||
      attr(node, "id") === "neurodiversa-olivia" ||
      (attr(node, "class") || "").includes("preview-notice")
    )
      return;
    if (node.tagName === "title") title = textOf(node);
    if (node.tagName === "meta" && attr(node, "name") === "description")
      description = attr(node, "content") || "";
    if (node.tagName === "head") return;
    if (node.tagName === "header") section = "navigation";
    else if (node.tagName === "footer") section = "footer";
    else if (
      attr(node, "id") &&
      ["section", "article", "main", "div"].includes(node.tagName)
    )
      section = attr(node, "id");
    if (/^h[1-3]$/.test(node.tagName || ""))
      heading = norm(textOf(node)).slice(0, 90);
    if (!sections.has(section))
      sections.set(section, {
        id: section,
        title:
          section === "navigation"
            ? "Navegación"
            : section === "footer"
              ? "Pie de página"
              : heading ||
                (section === "page" ? "Contenido de la página" : section),
        anchor: ["navigation", "footer", "page"].includes(section)
          ? ""
          : section,
      });
    const runtime = ["title", "start", "weeks", "minutes"].find(
      (key) => attr(node, `data-program-${key}`) !== undefined,
    );
    const scope = runtime
      ? "global-program"
      : ["navigation", "footer"].includes(section)
        ? `global-${locale}`
        : pageId;
    const keyTrail = ["navigation", "footer"].includes(section)
      ? trail.slice(
          trail.indexOf(section === "navigation" ? "/header[" : "/footer["),
        )
      : trail;
    const add = (kind, value, suffix, label, extra = {}) => {
      const key = digest(
          runtime ? `program.${runtime}` : `${section}:${keyTrail}:${suffix}`,
        ).slice(0, 24),
        id = `${scope}:${key}`,
        field = {
          id,
          key,
          document: scope,
          page: pageId,
          kind,
          section,
          label: label || heading || value.slice(0, 70),
          source: value,
          sourceHash: digest(`${kind}:${value}`),
          ...(runtime ? { runtime: `program.${runtime}` } : {}),
          ...extra,
        };
      fields.push(field);
      return field;
    };
    if (node.tagName === "img" && attr(node, "src")) {
      const row = add(
        "image",
        attr(node, "src"),
        "image",
        attr(node, "alt") || heading || "Fotografía",
        { alt: attr(node, "alt") || "" },
      );
      setAttr(
        node,
        "data-studio-image",
        JSON.stringify({ collection: scope, id: row.key }),
      );
    }
    if (
      node.tagName === "a" &&
      attr(node, "href") &&
      !/^javascript:/i.test(attr(node, "href"))
    ) {
      const href = attr(node, "href");
      if (!(
        (norm(textOf(node)) === "EN" || norm(textOf(node)) === "ES") &&
        /^\//.test(href)
      )) {
        const row = add(
          "link",
          href,
          "href",
          `Enlace: ${norm(textOf(node)).slice(0, 60) || heading || "Botón"}`,
        );
        setAttr(node, "data-site-link", row.id);
      }
    }
    if (!node.childNodes) return;
    const counts = {};
    node.childNodes = node.childNodes.map((child, index) => {
      const tag = child.tagName || child.nodeName;
      counts[tag] = (counts[tag] || 0) + 1;
      const next = `${trail}/${tag}[${counts[tag]}]`;
      if (
        child.nodeName === "#text" &&
        norm(child.value) &&
        node.tagName &&
        !ignored.has(node.tagName)
      ) {
        const value = child.value,
          clean = norm(value);
        if (!/[\p{L}\p{N}]/u.test(clean)) return child;
        const row = add(
          "text",
          value,
          `text-${counts[tag]}`,
          `${heading ? heading + " · " : ""}${clean.slice(0, 75)}`,
        );
        const wrapper = parseFragment("<nd-edit></nd-edit>").childNodes[0];
        setAttr(wrapper, "data-studio-text", JSON.stringify({ key: row.id }));
        wrapper.childNodes = [child];
        wrapper.parentNode = node;
        child.parentNode = wrapper;
        return wrapper;
      }
      visit(child, next, section, heading);
      return child;
    });
  };
  // Metadata are read directly; traversal excludes executable head content.
  const meta = (node) => {
    if (node.tagName === "title") title = textOf(node);
    if (node.tagName === "meta" && attr(node, "name") === "description")
      description = attr(node, "content") || "";
    for (const child of node.childNodes || [])
      if (node.tagName !== "script") meta(child);
  };
  meta(doc);
  visit(doc);
  return {
    version: 1,
    id: pageId,
    path,
    locale,
    title,
    description,
    sections: [...sections.values()],
    fields,
    html: serialize(doc),
  };
}
export function applyValues(
  bundle,
  documents,
  { preview = false, site = "https://neurodiversa.mx" } = {},
) {
  const doc = parse(bundle.html),
    values = {};
  for (const field of bundle.fields) {
    const state = documents[field.document];
    if (state?.values && Object.hasOwn(state.values, field.id))
      values[field.id] = state.values[field.id];
  }
  const fieldMap = new Map(bundle.fields.map((f) => [f.id, f])),
    textAnchors = new Map(),
    sectionAnchors = new Map();
  const walk = (node) => {
    if (attr(node, "id")) sectionAnchors.set(attr(node, "id"), node);
    const marker = attr(node, "data-studio-text");
    if (marker) {
      let key;
      try {
        key = JSON.parse(marker).key;
      } catch {}
      if (key) textAnchors.set(key, node.parentNode);
      if (Object.hasOwn(values, key)) {
        node.childNodes = parseFragment(
          inlineHtml(String(values[key])),
        ).childNodes;
        for (const child of node.childNodes) child.parentNode = node;
        // A paragraph cannot contain other paragraphs, headings or lists. Keep
        // its classes and catalogue IDs while making rich bodies valid HTML.
        if (
          /<(?:p|h[23]|ul|ol)>/i.test(String(values[key])) &&
          node.parentNode?.tagName === "p"
        ) {
          node.parentNode.tagName = node.parentNode.nodeName = "div";
        }
      }
    }
    const imageMarker = attr(node, "data-studio-image");
    if (imageMarker) {
      let target;
      try {
        target = JSON.parse(imageMarker);
      } catch {}
      const key = target ? `${target.collection}:${target.id}` : "";
      if (Object.hasOwn(values, key)) {
        setAttr(node, "src", imageUrl(values[key], preview));
        node.attrs = node.attrs.filter((a) => a.name !== "srcset");
        if (node.parentNode?.tagName === "picture")
          node.parentNode.childNodes = node.parentNode.childNodes.filter(
            (c) => c.tagName !== "source",
          );
      }
    }
    const link = attr(node, "data-site-link");
    if (link && Object.hasOwn(values, link))
      setAttr(node, "href", String(values[link]));
    for (const child of node.childNodes || []) walk(child);
    if (!preview && node.attrs)
      node.attrs = node.attrs.filter(
        (a) =>
          !["data-studio-text", "data-studio-image", "data-site-link"].includes(
            a.name,
          ),
      );
  };
  walk(doc);
  const main = (() => {
    const find = (node) =>
      node.tagName === "main"
        ? node
        : (node.childNodes || []).map(find).find(Boolean);
    return find(doc);
  })();
  const cursors = new Map();
  for (const block of documents[bundle.id]?.blocks || []) {
    const anchor = block.anchor?.startsWith("text:")
      ? textAnchors.get(block.anchor.slice(5))
      : sectionAnchors.get((block.anchor || "").replace(/^section:/, ""));
    const nodes = parseFragment(renderSiteBlock(block, { preview })).childNodes;
    const cursorKey = `${block.anchor}:${block.position || "after"}`;
    const target = cursors.get(cursorKey) || anchor;
    const parent = target?.parentNode || main;
    if (!parent) continue;
    const index = target
      ? parent.childNodes.indexOf(target) +
        (block.position === "before" && !cursors.has(cursorKey) ? 0 : 1)
      : parent.childNodes.length;
    for (const node of nodes) node.parentNode = parent;
    parent.childNodes.splice(index, 0, ...nodes);
    if (nodes.length) cursors.set(cursorKey, nodes.at(-1));
  }
  const page = documents[bundle.id],
    seo = page?.seo || {};
  const head = doc.childNodes
    .find((n) => n.tagName === "html")
    ?.childNodes.find((n) => n.tagName === "head");
  if (head) {
    const richStyle = parseFragment(
      `<style>${richTextStyles}${siteBlockStyles}</style>`,
    ).childNodes[0];
    richStyle.parentNode = head;
    head.childNodes.push(richStyle);
    for (const node of head.childNodes || []) {
      if (node.tagName === "title" && seo.title)
        node.childNodes = [
          { nodeName: "#text", value: seo.title, parentNode: node },
        ];
      if (node.tagName === "meta") {
        const name = attr(node, "name") || attr(node, "property");
        if (
          ["description", "og:description", "twitter:description"].includes(
            name,
          ) &&
          seo.description
        )
          setAttr(node, "content", seo.description);
        if (["og:title", "twitter:title"].includes(name) && seo.title)
          setAttr(node, "content", seo.title);
        if (name === "robots" && seo.noindex)
          setAttr(node, "content", "noindex,nofollow");
      }
    }
    if (
      seo.noindex &&
      !head.childNodes.some(
        (n) => n.tagName === "meta" && attr(n, "name") === "robots",
      )
    ) {
      const meta = parseFragment(
        '<meta name="robots" content="noindex,nofollow">',
      ).childNodes[0];
      meta.parentNode = head;
      head.childNodes.push(meta);
    }
  }
  return serialize(doc);
}
export function inlineHtml(value) {
  return richTextHtml(value);
}
export function imageUrl(value, preview = false) {
  if (String(value).startsWith("cms:"))
    return `${preview ? "/api/admin/site/asset/" : "/api/public/site-image/"}${String(value).slice(4)}`;
  return String(value);
}
export function cleanPreview(html, path) {
  const doc = parse(html),
    remove = new Set([
      "script",
      "iframe",
      "object",
      "embed",
      "base",
      "noscript",
      "template",
    ]);
  const walk = (node) => {
    node.childNodes = (node.childNodes || []).filter(
      (child) =>
        !remove.has(child.tagName) &&
        !(child.tagName === "meta" && attr(child, "http-equiv")) &&
        !(
          child.tagName === "link" &&
          ["modulepreload", "preload", "prefetch"].includes(attr(child, "rel"))
        ) &&
        attr(child, "id") !== "neurodiversa-olivia",
    );
    for (const child of node.childNodes) {
      if (child.attrs)
        child.attrs = child.attrs.filter(
          (a) =>
            !/^on/i.test(a.name) &&
            ![
              "srcdoc",
              "autofocus",
              "formaction",
              "action",
              "target",
              "ping",
              "download",
              "nonce",
            ].includes(a.name) &&
            !(
              ["href", "src"].includes(a.name) &&
              /^\s*(javascript|vbscript):/i.test(a.value)
            ),
        );
      for (const a of child.attrs || []) {
        if (
          (a.name === "href" &&
            child.tagName === "link" &&
            attr(child, "rel") === "stylesheet") ||
          ((a.name === "src" || a.name === "poster") &&
            a.value.startsWith("/") &&
            !a.value.startsWith("/api/"))
        ) {
          a.value =
            "/api/admin/site/preview-asset?file=" + encodeURIComponent(a.value);
        }
        if (a.name === "srcset") a.value = "";
      }
      walk(child);
    }
  };
  walk(doc);
  const head = doc.childNodes
    .find((n) => n.tagName === "html")
    .childNodes.find((n) => n.tagName === "head");
  for (const code of [
    '<base href="/">',
    '<meta name="neurodiversa-preview" content="visual">',
    '<meta name="robots" content="noindex,nofollow">',
  ]) {
    const n = parseFragment(code).childNodes[0];
    n.parentNode = head;
    head.childNodes.push(n);
  }
  const style = parseFragment("<style></style>").childNodes[0];
  style.parentNode = head;
  style.childNodes = [
    {
      nodeName: "#text",
      parentNode: style,
      value:
        "html{scroll-behavior:auto!important}*,*:before,*:after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}nd-edit{display:inline}[data-studio-editable]{outline:none;cursor:text;white-space:normal}[data-studio-editable]:hover{outline:2px solid #87424d;outline-offset:3px}[data-studio-editable]:focus,[data-studio-selected]{outline:2px solid #ba9861!important;outline-offset:3px}[data-studio-photo]{cursor:pointer}[data-studio-photo]:hover{outline:3px solid #87424d;outline-offset:-3px}body[data-studio-readonly] [data-studio-editable]:hover,body[data-studio-readonly] [data-studio-photo]:hover{outline:none}.preview-banner,.mobile-bottom-cta{display:none!important}",
    },
  ];
  head.childNodes.push(style);
  return serialize(doc);
}
