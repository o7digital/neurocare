// Adapted from Nathalie Studio; catalogue IDs and saved values stay compatible.
import {
  escapeText as esc,
  richTextHtml as safeHtml,
  safeTextLink,
  richTextStyles,
} from "../../../../cms/site-rich-text.mjs";
export const targetKey = (target) =>
  target.key
    ? `text:${target.key}`
    : `${target.collection}:${target.id}:${target.field || "image"}`;
const sizes = { auto: 0, desktop: 1440, tablet: 820, mobile: 390 };
const names = {
  auto: "Tamaño real",
  desktop: "Ordenador",
  tablet: "Tableta",
  mobile: "Móvil",
};

export function visualEditorMarkup() {
  return `<section class="visual-editor" aria-label="Editor visual de la página">
 <div class="visual-toolbar"><div class="visual-modes" role="group" aria-label="Modo del editor"><button type="button" data-visual-mode="edit" aria-pressed="true">Editar página</button><button type="button" data-visual-mode="preview" aria-pressed="false">Vista previa</button></div><div class="visual-devices" role="group" aria-label="Tamaño de pantalla">${Object.keys(
   sizes,
 )
   .map(
     (device) =>
       `<button type="button" data-visual-device="${device}" aria-pressed="${device === "desktop"}">${names[device]}</button>`,
   )
   .join(
     "",
   )}</div><button type="button" class="icon-button" data-visual-expand aria-label="Ampliar editor">⛶</button><button type="button" class="button primary" data-visual-save disabled>Guardar cambios</button></div>
 <div class="visual-format-bar" role="toolbar" aria-label="Formato del texto"><select data-format-block aria-label="Estilo del texto" disabled><option value="p">Párrafo</option><option value="h2">Título</option><option value="h3">Subtítulo</option></select><button type="button" data-format="bold" aria-label="Negrita" aria-pressed="false" disabled><strong>B</strong></button><button type="button" data-format="italic" aria-label="Cursiva" aria-pressed="false" disabled><em>I</em></button><button type="button" data-format="underline" aria-label="Subrayado" aria-pressed="false" disabled><u>U</u></button><button type="button" data-format="insertUnorderedList" aria-label="Lista con viñetas" data-block-format disabled>• Lista</button><button type="button" data-format="insertOrderedList" aria-label="Lista numerada" data-block-format disabled>1. Lista</button><button type="button" data-format="createLink" aria-label="Insertar enlace" disabled>Enlace</button><button type="button" data-format="insertLineBreak" aria-label="Salto de línea" disabled>↵</button><button type="button" data-format="removeFormat" aria-label="Quitar formato" disabled>Quitar formato</button><span>Selecciona texto en la página para darle formato.</span></div>
 <div class="visual-status" role="status">Haz clic en un texto o una fotografía para editar.</div>
 <div class="visual-workbench"><div class="visual-canvas"><div class="visual-browser"><span aria-hidden="true">● ● ●</span><span>Tu sitio · Diseño real</span><span class="visual-dimensions">1440 px</span></div><div class="visual-viewport"><div class="visual-frame-wrap"><iframe title="Página de Neuro Diversa · Editor visual" sandbox="allow-same-origin"></iframe></div><div class="visual-loading" role="status"><span class="loader"></span><strong>Preparando tu página…</strong></div></div></div>
 <aside class="visual-inspector" aria-label="Contenido seleccionado"><div class="visual-inspector-tabs"><button type="button" data-inspector="edit" aria-pressed="true">Editar</button><button type="button" data-inspector="contents" aria-pressed="false">Contenido</button></div><div class="visual-inspector-content"><div class="visual-welcome"><span aria-hidden="true">✎</span><h2>Tu página, en tus manos.</h2><p>Haz clic en un texto para escribir directamente sobre el diseño.</p><p>Selecciona una fotografía para cambiarla y ver el resultado al instante.</p><p>Guarda los cambios y revisa el resultado antes de publicar.</p></div></div></aside></div>
 <p class="visual-error form-error" role="alert"></p><input class="visual-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden></section>`;
}

// Read only supported formatting; clipboard styles, scripts and images never
// become saved content. Plain-text values retain the existing storage format.
export function editorValue(element, { blocks = true } = {}) {
  const visit = (node) => {
    if (node.nodeType === 3) return node.textContent;
    if (
      node.nodeType !== 1 ||
      ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "TEMPLATE"].includes(
        node.tagName,
      )
    )
      return "";
    const children = [...node.childNodes].map(visit).join("");
    if (node.tagName === "BR") return "<br/>";
    if (["B", "STRONG"].includes(node.tagName))
      return `<strong>${children}</strong>`;
    if (["I", "EM"].includes(node.tagName)) return `<em>${children}</em>`;
    if (["U", "S"].includes(node.tagName))
      return `<${node.tagName.toLowerCase()}>${children}</${node.tagName.toLowerCase()}>`;
    if (node.tagName === "SPAN") {
      let value = children;
      if (/^\d+$/.test(node.dataset.size || ""))
        value = `<span data-size="${node.dataset.size}">${value}</span>`;
      if (/^(sans|serif|georgia)$/.test(node.dataset.font || ""))
        value = `<span data-font="${node.dataset.font}">${value}</span>`;
      return value;
    }
    if (node.tagName === "A" && safeTextLink(node.getAttribute("href")))
      return `<a href="${node.getAttribute("href")}">${children}</a>`;
    if (["DIV", "P", "H2", "H3", "UL", "OL", "LI"].includes(node.tagName)) {
      if (!blocks) return `${children}<br/>`;
      const tag = node.tagName === "DIV" ? "p" : node.tagName.toLowerCase();
      return `<${tag}>${children}</${tag}>`;
    }
    return children;
  };
  return [...element.childNodes]
    .map(visit)
    .join("")
    .replace(/(?:<br\/>)+$/, "");
}

export function mountVisualEditor(
  root,
  {
    section,
    rows,
    photos,
    valueOf,
    photoOf,
    onText,
    onPhoto,
    onSave,
    prefs,
    dirtyCount,
    busy,
    canEdit = () => true,
    onConvertText,
    onEditVideo = () => {},
  },
) {
  const frame = root.querySelector("iframe"),
    viewport = root.querySelector(".visual-viewport"),
    inspector = root.querySelector(".visual-inspector-content");
  root
    .querySelector(".visual-format-bar")
    .insertAdjacentHTML(
      "afterbegin",
      `<style>${richTextStyles}</style><select data-format-value="font" aria-label="Tipografía del texto" disabled><option value="sans">Arial</option><option value="georgia">Georgia</option></select><select data-format-value="size" aria-label="Tamaño de letra" disabled>${[12, 14, 16, 18, 20, 24, 32, 40, 48, 64].map((size) => `<option value="${size}"${size === 18 ? " selected" : ""}>${size} px</option>`).join("")}</select>`,
    );
  const fields = new Map(rows.map((row) => [targetKey(row.target), row])),
    pictures = new Map(
      photos.map((row) => [`${row.collection}:${row.id}`, row]),
    );
  // innerText includes CSS text-transform; keep the artist's original capitalization.
  const readValue = (row, node) =>
    row.rich
      ? editorValue(node, { blocks: row.block })
      : node.textContent.replace(/\n/g, " ");
  const htmlOf = (row, value) => (row.rich ? safeHtml(value) : esc(value));
  const anyEditable = () =>
    rows.some((row) => canEdit(row.target)) ||
    photos.some((row) => canEdit(row));
  const targets = new Map(),
    imageNodes = new Map();
  let doc,
    activated,
    selected,
    activeEditor,
    destroyed = false,
    mode = "edit",
    device = prefs.device || "auto",
    saving = false;
  const listen = (element, type, fn) => element.addEventListener(type, fn);
  const photoUrl = (row) => photoOf(row);
  function status() {
    const count = dirtyCount();
    root.querySelector(".visual-status").textContent = saving
      ? "Guardando…"
      : !anyEditable()
        ? "Esta sección está fijada en SEO. Desbloquéala para editar."
        : count
          ? `${count} cambio${count === 1 ? "" : "s"} sin guardar`
          : "Haz clic en un texto o una fotografía para editar.";
    root.querySelector("[data-visual-save]").disabled =
      saving || busy() || !count || !anyEditable();
  }
  function highlight(node) {
    doc
      ?.querySelectorAll("[data-studio-selected]")
      .forEach((el) => el.removeAttribute("data-studio-selected"));
    // Outline a whole paragraph rather than every line of an inline wrapper.
    const parent = node?.parentElement;
    (parent?.matches("p,h1,h2,h3") ? parent : node)?.setAttribute(
      "data-studio-selected",
      "",
    );
  }
  function change(row, value, origin) {
    if (!canEdit(row.target)) return;
    if (valueOf(row.target) !== value) onText(row.target, value);
    for (const node of targets.get(targetKey(row.target)) || [])
      if (node !== origin) node.innerHTML = htmlOf(row, value);
    const input = inspector.querySelector("[data-visual-text]");
    if (input && input !== origin && selected?.row === row)
      input.innerHTML = htmlOf(row, value);
    status();
  }
  function rememberSelection(node, row) {
    const selection = node.ownerDocument.getSelection();
    if (
      selection?.rangeCount &&
      node.contains(selection.anchorNode) &&
      node.contains(selection.focusNode)
    ) {
      activeEditor = { node, row, range: selection.getRangeAt(0).cloneRange() };
      formatStatus();
    }
  }
  function formatStatus() {
    const editable =
      mode === "edit" &&
      selected?.kind === "text" &&
      selected.row.rich &&
      canEdit(selected.row.target);
    root
      .querySelectorAll(
        "[data-format], [data-format-block], [data-format-value]",
      )
      .forEach((control) => {
        control.disabled =
          !editable ||
          ((control.hasAttribute("data-block-format") ||
            control.hasAttribute("data-format-block")) &&
            !selected.row.block);
        if (control.hasAttribute("aria-pressed")) {
          control.setAttribute(
            "aria-pressed",
            String(
              !!editable &&
                !!activeEditor?.node.ownerDocument.queryCommandState(
                  control.dataset.format,
                ),
            ),
          );
        }
      });
  }
  function showText(row, focus = false) {
    selected = { kind: "text", row };
    const nodes = targets.get(targetKey(row.target)) || [];
    highlight(nodes[0]);
    inspector.innerHTML = `<span class="visual-kind">TEXTO DEL SITIO</span><h2>${esc(row.label)}</h2><div class="visual-text-input" data-visual-text contenteditable="${row.rich ? "true" : "plaintext-only"}" role="textbox" aria-multiline="true" aria-label="Texto seleccionado" spellcheck="true">${htmlOf(row, valueOf(row.target))}</div><p>Escribe en la página o aquí. Usa la barra superior para dar formato al texto seleccionado.</p>${nodes.length ? '<button type="button" class="button quiet" data-focus-visual>Ir al texto</button>' : "<p>Este texto pertenece a un control o contenido desplegable de la sección.</p>"}`;
    const input = inspector.querySelector("[data-visual-text]");
    if (
      onConvertText &&
      row.rich &&
      row.block &&
      row.target.key.startsWith("page-")
    ) {
      input.insertAdjacentHTML(
        "afterend",
        '<button type="button" class="button quiet" data-convert-block>Convertir este texto en bloque</button>',
      );
    }
    if (!canEdit(row.target)) {
      input.contentEditable = "false";
      input.setAttribute("aria-readonly", "true");
      inspector.querySelector(".visual-format")?.remove();
      const note = document.createElement("p");
      note.className = "visual-locked-note";
      note.textContent =
        "Este texto está fijado en SEO, también cuando se comparte con otra sección. Desbloquea esa sección para modificarlo.";
      input.after(note);
    }
    listen(input, "input", () => change(row, readValue(row, input), input));
    listen(input, "focus", () => {
      activeEditor = { node: input, row };
      formatStatus();
    });
    listen(input, "paste", (event) => paste(event, row, input));
    formatStatus();
    if (focus) input.focus();
  }
  function showPhoto(row, node) {
    selected = { kind: "image", row, node };
    activeEditor = null;
    formatStatus();
    highlight(node);
    inspector.innerHTML = `<span class="visual-kind">FOTOGRAFÍA</span><h2>${esc(row.label)}</h2><img class="visual-photo" src="${esc(photoUrl(row))}" alt="${esc(row.label)}"><button type="button" class="button primary" data-upload-visual>Cambiar fotografía</button><p>JPG, PNG, WebP o AVIF · Hasta 25 MB · optimizada automáticamente.</p><p>Elige una foto y revisa el resultado en la página. Guarda para conservar el cambio.</p>`;
    inspector.querySelector("[data-upload-visual]").textContent =
      "Subir una fotografía";
    if (row.collection === "videos") {
      inspector.querySelector(".visual-kind").textContent = "PORTADA DEL VÍDEO";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button quiet";
      button.dataset.editVisualVideo = "";
      button.textContent = "Subir o cambiar el vídeo";
      button.disabled = !canEdit(row);
      inspector.querySelector("[data-upload-visual]").after(button);
    }
    if (!canEdit(row)) {
      inspector.querySelector("[data-upload-visual]").disabled = true;
      const note = document.createElement("p");
      note.className = "visual-locked-note";
      note.textContent =
        "Esta fotografía pertenece a una sección fijada en SEO.";
      inspector.append(note);
    }
  }
  function outline() {
    inspector.innerHTML = `<span class="visual-kind">${esc(section.title)}</span><h2>Contenido de la sección</h2><div class="visual-outline">${rows
      .map(
        (row, index) =>
          `<button type="button" data-outline-text="${index}"><strong>${esc(row.label)}</strong><span>${esc(
            String(valueOf(row.target))
              .replace(/<[^>]*>/g, "")
              .slice(0, 100),
          )}</span></button>`,
      )
      .join(
        "",
      )}${photos.map((row, index) => `<button type="button" data-outline-photo="${index}"><img src="${esc(photoUrl(row))}" alt=""><span>${esc(row.label)}</span></button>`).join("")}</div>`;
  }
  function resize() {
    if (destroyed) return;
    const width = sizes[device] || Math.max(280, viewport.clientWidth - 24),
      scale = Math.max(0.1, Math.min(1, (viewport.clientWidth - 24) / width)),
      height = Math.max(350, viewport.clientHeight - 24);
    const wrap = root.querySelector(".visual-frame-wrap");
    wrap.style.width = `${width * scale}px`;
    wrap.style.height = `${height}px`;
    frame.style.width = `${width}px`;
    frame.style.height = `${height / scale}px`;
    frame.style.transform = `scale(${scale})`;
    root.querySelector(".visual-dimensions").textContent =
      `${Math.round(width)} px · ${Math.round(scale * 100)} %`;
    root
      .querySelectorAll("[data-visual-device]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.visualDevice === device),
        ),
      );
  }
  function scrollToSection() {
    if (!doc || section.id === "settings") return;
    const target = doc.getElementById(section.anchor);
    if (!target) return;
    const header = doc.querySelector("body>header");
    doc.defaultView.scrollTo(
      0,
      target.getBoundingClientRect().top +
        doc.defaultView.scrollY -
        (header?.getBoundingClientRect().height || 0) -
        20,
    );
  }
  function setMode(next) {
    mode = next;
    doc?.body.toggleAttribute("data-studio-readonly", next === "preview");
    for (const [key, nodes] of targets)
      for (const node of nodes) {
        const editable = canEdit(fields.get(key).target);
        node.contentEditable =
          next === "edit" && editable
            ? fields.get(key).rich
              ? "true"
              : "plaintext-only"
            : "false";
        node.setAttribute(
          "aria-readonly",
          String(next !== "edit" || !editable),
        );
        node.toggleAttribute("data-studio-locked", !editable);
        if (!editable) node.tabIndex = 0;
      }
    root
      .querySelectorAll("[data-visual-mode]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.visualMode === next),
        ),
      );
    root.classList.toggle("is-preview", next === "preview");
    if (next === "preview") highlight(null);
    formatStatus();
  }
  function paste(event, row, node) {
    event.preventDefault();
    if (!canEdit(row.target)) return;
    const owner = node.ownerDocument;
    if (!row.rich) {
      owner.execCommand(
        "insertText",
        false,
        event.clipboardData.getData("text/plain"),
      );
      return;
    }
    const html = event.clipboardData.getData("text/html");
    let content;
    if (html) {
      const fragment = owner.createElement("template");
      fragment.innerHTML = html;
      content = safeHtml(editorValue(fragment.content, { blocks: row.block }));
    } else {
      content = esc(event.clipboardData.getData("text/plain")).replace(
        /\r?\n/g,
        "<br/>",
      );
    }
    owner.execCommand("insertHTML", false, content);
    change(row, readValue(row, node), node);
  }
  function applyPhotos() {
    for (const [key, nodes] of imageNodes) {
      const row = pictures.get(key);
      for (const node of nodes) {
        node.removeAttribute("srcset");
        node
          .closest("picture")
          ?.querySelectorAll("source")
          .forEach((source) => source.removeAttribute("srcset"));
        node.src = photoUrl(row);
      }
    }
  }
  async function save() {
    if (saving || busy() || !dirtyCount() || !anyEditable()) return;
    saving = true;
    status();
    root.querySelector(".visual-error").textContent = "";
    root.inert = true;
    for (const nodes of targets.values())
      for (const node of nodes) node.contentEditable = "false";
    try {
      await onSave();
    } catch (error) {
      if (!destroyed)
        root.querySelector(".visual-error").textContent = error.message;
    } finally {
      saving = false;
      if (!destroyed) {
        root.inert = false;
        setMode(mode);
        status();
      }
    }
  }
  function activate() {
    if (destroyed) return;
    doc = frame.contentDocument;
    const loading = root.querySelector(".visual-loading");
    if (!doc?.querySelector('meta[name="neurodiversa-preview"]')) {
      let message = "No se pudo abrir la página. Vuelve a intentar.";
      try {
        message = JSON.parse(doc.body.textContent).error || message;
      } catch {}
      loading.innerHTML = `<strong>La página no está disponible.</strong><p>${esc(message)}</p><button type="button" class="button" data-visual-retry>Volver a intentar</button>`;
      return;
    }
    if (activated === doc) return;
    activated = doc;
    targets.clear();
    imageNodes.clear();
    for (const node of doc.querySelectorAll("[data-studio-text]")) {
      let target;
      try {
        target = JSON.parse(node.dataset.studioText);
      } catch {
        continue;
      }
      const key = targetKey(target),
        row = fields.get(key);
      if (!row) continue;
      row.block =
        !node.closest("h1,h2,h3,h4,h5,h6,a,button,label,small,li") &&
        node.parentElement?.matches("p,div") &&
        [...node.parentElement.childNodes].every(
          (child) =>
            child === node ||
            (child.nodeType === 3 && !child.textContent.trim()),
        );
      if (row.block) node.style.display = "block";
      node.dataset.studioEditable = "";
      node.setAttribute("role", "textbox");
      node.setAttribute("aria-label", row.label);
      node.setAttribute("aria-multiline", "true");
      node.spellcheck = true;
      node.innerHTML = htmlOf(row, valueOf(target));
      if (!targets.has(key)) targets.set(key, []);
      targets.get(key).push(node);
      listen(node, "focus", () => {
        if (mode === "edit" && selected?.row !== row) showText(row);
        activeEditor = { node, row };
        formatStatus();
      });
      listen(node, "input", () => change(row, readValue(row, node), node));
      listen(node, "paste", (event) => paste(event, row, node));
      listen(node, "beforeinput", (event) => {
        if (!canEdit(row.target)) {
          event.preventDefault();
          return;
        }
        if (event.inputType === "insertParagraph" && !row.block) {
          event.preventDefault();
          doc.execCommand(
            row.rich ? "insertLineBreak" : "insertText",
            false,
            row.rich ? null : " ",
          );
        }
      });
    }
    for (const node of doc.querySelectorAll("img[data-studio-image]")) {
      let target;
      try {
        target = JSON.parse(node.dataset.studioImage);
      } catch {
        continue;
      }
      const key = `${target.collection}:${target.id}`,
        row = pictures.get(key);
      if (!row) continue;
      if (!imageNodes.has(key)) imageNodes.set(key, []);
      imageNodes.get(key).push(node);
      node.dataset.studioPhoto = "";
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", `Cambiar fotografía: ${row.label}`);
      listen(node, "click", (event) => {
        if (mode === "edit") {
          event.preventDefault();
          event.stopPropagation();
          showPhoto(row, node);
        }
      });
      listen(node, "keydown", (event) => {
        if (mode === "edit" && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
          showPhoto(row, node);
        }
      });
    }
    applyPhotos();
    setMode(mode);
    resize();
    loading.hidden = true;
    status();
    if (prefs.scroll?.path === prefs.path)
      doc.defaultView.scrollTo(0, prefs.scroll.top);
    else scrollToSection();
    listen(doc, "click", (event) => {
      if (event.target.closest("[data-studio-editable]")) {
        if (mode === "edit") event.preventDefault();
      } else if (event.target.closest("summary")) return;
      else if (event.target.closest("a,button,input,select,textarea"))
        event.preventDefault();
    });
    listen(doc, "submit", (event) => event.preventDefault());
    listen(doc, "selectionchange", () => {
      if (activeEditor?.node.ownerDocument === doc)
        rememberSelection(activeEditor.node, activeEditor.row);
    });
    listen(doc, "keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        save();
      }
    });
  }
  listen(frame, "load", activate);
  listen(root, "pointerdown", (event) => {
    if (
      event.target.closest(
        "[data-format], [data-format-block], [data-format-value]",
      )
    ) {
      if (activeEditor) rememberSelection(activeEditor.node, activeEditor.row);
      if (event.target.closest("[data-format]")) event.preventDefault();
    }
  });
  function format(command, value) {
    if (
      !activeEditor?.node.isConnected ||
      selected?.kind !== "text" ||
      activeEditor.row !== selected.row ||
      !canEdit(selected.row.target)
    )
      return;
    const { node, row, range } = activeEditor;
    const owner = node.ownerDocument;
    node.focus();
    if (range && node.contains(range.commonAncestorContainer)) {
      const selection = owner.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (command === "createLink") {
      const link = window.prompt(
        "Dirección del enlace (https://…)",
        "https://",
      );
      if (link === null) return;
      if (!link.trim()) command = "unlink";
      else if (!safeTextLink(link.trim())) {
        root.querySelector(".visual-error").textContent =
          "Usa un enlace https://, http://, mailto: o una ruta del sitio.";
        return;
      } else value = link.trim();
    }
    owner.execCommand(command, false, value);
    change(row, readValue(row, node), node);
    rememberSelection(node, row);
  }
  listen(root.querySelector("[data-format-block]"), "change", (event) => {
    if (selected?.row?.block) format("formatBlock", event.target.value);
  });
  root.querySelectorAll("[data-format-value]").forEach((control) =>
    listen(control, "change", () => {
      if (!activeEditor?.node.isConnected || !canEdit(activeEditor.row.target))
        return;
      const { node, row } = activeEditor,
        owner = node.ownerDocument;
      node.focus();
      const selection = owner.getSelection();
      const range = activeEditor.range?.cloneRange() || owner.createRange();
      if (!activeEditor.range || range.collapsed)
        range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
      const fragment = range.cloneContents(),
        kind = control.dataset.formatValue;
      fragment
        .querySelectorAll(`[data-${kind}]`)
        .forEach((span) => span.replaceWith(...span.childNodes));
      const html = safeHtml(editorValue(fragment, { blocks: row.block }));
      owner.execCommand(
        "insertHTML",
        false,
        `<span data-${kind}="${control.value}">${html}</span>`,
      );
      change(row, readValue(row, node), node);
      rememberSelection(node, row);
    }),
  );
  const parentSelection = () => {
    if (activeEditor?.node.ownerDocument === document)
      rememberSelection(activeEditor.node, activeEditor.row);
  };
  document.addEventListener("selectionchange", parentSelection);
  listen(root, "click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.visualMode) setMode(button.dataset.visualMode);
    if (button.dataset.visualDevice) {
      device = button.dataset.visualDevice;
      prefs.device = device;
      resize();
      requestAnimationFrame(scrollToSection);
    }
    if (button.hasAttribute("data-visual-expand")) {
      root.classList.toggle("visual-expanded");
      resize();
    }
    if (button.hasAttribute("data-visual-save")) save();
    if (button.hasAttribute("data-visual-retry")) {
      loadingPage();
    }
    if (button.dataset.inspector) {
      root
        .querySelectorAll("[data-inspector]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      if (button.dataset.inspector === "contents") outline();
      else if (selected?.kind === "text") showText(selected.row);
      else if (selected?.kind === "image")
        showPhoto(selected.row, selected.node);
    }
    if (button.dataset.outlineText !== undefined) {
      const row = rows[Number(button.dataset.outlineText)];
      showText(row, true);
      targets
        .get(targetKey(row.target))?.[0]
        ?.scrollIntoView({ block: "center" });
    }
    if (button.dataset.outlinePhoto !== undefined) {
      const row = photos[Number(button.dataset.outlinePhoto)],
        node = imageNodes.get(`${row.collection}:${row.id}`)?.[0];
      node?.scrollIntoView({ block: "center" });
      showPhoto(row, node);
    }
    if (button.hasAttribute("data-upload-visual"))
      root.querySelector(".visual-upload").click();
    if (
      button.hasAttribute("data-edit-visual-video") &&
      selected?.kind === "image" &&
      canEdit(selected.row)
    )
      onEditVideo(selected.row);
    if (button.hasAttribute("data-focus-visual")) {
      const node = targets.get(targetKey(selected.row.target))?.[0];
      node?.scrollIntoView({ block: "center" });
      node?.focus();
    }
    if (button.hasAttribute("data-convert-block") && selected?.kind === "text")
      onConvertText?.(selected.row.target);
    if (
      button.dataset.format &&
      selected?.kind === "text" &&
      canEdit(selected.row.target)
    ) {
      format(button.dataset.format);
    }
  });
  listen(root.querySelector(".visual-upload"), "change", async (event) => {
    const file = event.target.files[0],
      target = selected;
    if (!file || target?.kind !== "image" || !canEdit(target.row)) return;
    const button = inspector.querySelector("[data-upload-visual]");
    button.disabled = true;
    button.textContent = "Subiendo fotografía…";
    try {
      await onPhoto(target.row, file);
      if (destroyed) return;
      applyPhotos();
      showPhoto(target.row, target.node);
      status();
    } catch (error) {
      if (!destroyed)
        root.querySelector(".visual-error").textContent = error.message;
    } finally {
      event.target.value = "";
      if (!destroyed && button.isConnected) {
        button.disabled = false;
        button.textContent = "Cambiar fotografía";
      }
    }
  });
  function loadingPage() {
    root.querySelector(".visual-loading").hidden = false;
    frame.src =
      "/api/admin/site/preview?page=" + encodeURIComponent(prefs.path || "/");
  }

  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  loadingPage();
  resize();
  status();
  return {
    refresh() {
      for (const row of rows)
        for (const node of targets.get(targetKey(row.target)) || [])
          if (readValue(row, node) !== valueOf(row.target)) {
            node.innerHTML = htmlOf(row, valueOf(row.target));
            if (activeEditor?.node === node) activeEditor.range = null;
          }
      const input = inspector.querySelector("[data-visual-text]");
      if (
        input &&
        selected?.kind === "text" &&
        readValue(selected.row, input) !== valueOf(selected.row.target)
      ) {
        input.innerHTML = htmlOf(selected.row, valueOf(selected.row.target));
        if (activeEditor?.node === input) activeEditor.range = null;
      }
      applyPhotos();
      status();
    },
    destroy() {
      if (doc?.defaultView)
        prefs.scroll = { path: prefs.path, top: doc.defaultView.scrollY };
      destroyed = true;
      observer.disconnect();
      document.removeEventListener("selectionchange", parentSelection);
      frame.removeEventListener("load", activate);
      root.classList.remove("visual-expanded");
    },
  };
}
