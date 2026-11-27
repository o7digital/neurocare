import { useEffect, useRef } from "react";
import { EditorContent, useEditor, Mark } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { editorValue } from "./visual-editor.js";
import type { SiteBlock, SiteField } from "./types";
const Typography = Mark.create({
  name: "siteTypography",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          /^(12|14|16|18|20|24|32|40|48|64)$/.test(element.dataset.size || "")
            ? element.dataset.size
            : null,
        renderHTML: (attrs: Record<string, string>) =>
          attrs.size ? { "data-size": attrs.size } : {},
      },
      font: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          /^(sans|serif|georgia)$/.test(element.dataset.font || "")
            ? element.dataset.font
            : null,
        renderHTML: (attrs: Record<string, string>) =>
          attrs.font ? { "data-font": attrs.font } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-size]" }, { tag: "span[data-font]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const size = HTMLAttributes["data-size"],
      font = HTMLAttributes["data-font"];
    return [
      "span",
      {
        ...HTMLAttributes,
        style: `${size ? `font-size:${size}px;` : ""}${font ? `font-family:${font === "sans" ? "Arial,sans-serif" : "Georgia,serif"}` : ""}`,
      },
      0,
    ];
  },
});

export function flattenBlocks(blocks: SiteBlock[]): SiteBlock[] {
  return blocks.flatMap((block) => [
    block,
    ...(block.children || []).flatMap(flattenBlocks),
  ]);
}
export function updateBlock(
  blocks: SiteBlock[],
  id: string,
  patch: Partial<SiteBlock>,
): SiteBlock[] {
  return blocks.map((block) =>
    block.id === id
      ? { ...block, ...patch }
      : {
          ...block,
          ...(block.children
            ? {
                children: block.children.map((column) =>
                  updateBlock(column, id, patch),
                ),
              }
            : {}),
        },
  );
}
function newBlock(type: SiteBlock["type"]): SiteBlock {
  return {
    id: crypto.randomUUID(),
    type,
    ...(type === "text"
      ? {
          html: "<p>Escribe aquí tu contenido.</p>",
          size: 18,
          font: "site",
          align: "left",
        }
      : type === "columns"
        ? { columns: 2, children: [[], [], []] }
        : { src: "", caption: "", alt: "" }),
  };
}
function RichBlock({
  block,
  change,
}: {
  block: SiteBlock;
  change: (patch: Partial<SiteBlock>) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false } }),
      Typography,
    ],
    content: block.html || "",
    onUpdate: ({ editor: current }) =>
      change({ html: editorValue(current.view.dom) }),
  });
  useEffect(() => {
    if (
      editor &&
      !editor.isFocused &&
      editorValue(editor.view.dom) !== block.html
    )
      editor.commands.setContent(block.html || "", { emitUpdate: false });
  }, [editor, block.html]);
  if (!editor) return null;
  const commands: [string, () => void, boolean][] = [
    [
      "Negrita",
      () => {
        editor.chain().focus().toggleBold().run();
      },
      editor.isActive("bold"),
    ],
    [
      "Cursiva",
      () => {
        editor.chain().focus().toggleItalic().run();
      },
      editor.isActive("italic"),
    ],
    [
      "Subrayado",
      () => {
        editor.chain().focus().toggleUnderline().run();
      },
      editor.isActive("underline"),
    ],
    [
      "Viñetas",
      () => {
        editor.chain().focus().toggleBulletList().run();
      },
      editor.isActive("bulletList"),
    ],
    [
      "Numeración",
      () => {
        editor.chain().focus().toggleOrderedList().run();
      },
      editor.isActive("orderedList"),
    ],
  ];
  return (
    <>
      <div
        className="block-rich-toolbar"
        role="toolbar"
        aria-label="Formato del bloque"
      >
        <select
          aria-label="Tipo de párrafo"
          value={
            editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "p"
          }
          onChange={(e) => {
            if (e.target.value === "p")
              editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({ level: e.target.value === "h2" ? 2 : 3 })
                .run();
          }}
        >
          <option value="p">Párrafo</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
        </select>
        {commands.map(([label, run, active]) => (
          <button type="button" key={label} aria-pressed={active} onClick={run}>
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const href = prompt("Dirección del enlace", "https://");
            if (href && /^(https?:\/\/|mailto:|\/(?!\/)|#)/.test(href))
              editor.chain().focus().setLink({ href }).run();
          }}
        >
          Enlace
        </button>
        <button
          type="button"
          aria-label="Deshacer"
          onClick={() => editor.chain().focus().undo().run()}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="Rehacer"
          onClick={() => editor.chain().focus().redo().run()}
        >
          ↷
        </button>
      </div>
      <div
        className="block-rich-body"
        style={{
          fontSize: block.size || 18,
          fontFamily:
            block.font === "sans"
              ? "Arial, sans-serif"
              : ["serif", "georgia"].includes(block.font || "")
                ? "Georgia, serif"
                : "inherit",
          textAlign: block.align || "left",
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
export default function PageBlocks({
  blocks,
  fields,
  change,
  upload,
  notify,
}: {
  blocks: SiteBlock[];
  fields: SiteField[];
  change: (blocks: SiteBlock[]) => void;
  upload: (file: File) => Promise<string>;
  notify: (message: string) => void;
}) {
  const latest = useRef(blocks);
  latest.current = blocks;
  const patchById = (id: string, value: Partial<SiteBlock>) =>
    change(updateBlock(latest.current, id, value));
  const transfer = (block: SiteBlock, destination: string) => {
    const remove = (rows: SiteBlock[]): SiteBlock[] =>
      rows
        .filter((row) => row.id !== block.id)
        .map((row) => ({
          ...row,
          ...(row.children ? { children: row.children.map(remove) } : {}),
        }));
    let next = remove(latest.current);
    if (!destination) next = [...next, block];
    else {
      const [id, column] = destination.split(":");
      const target = next.find((row) => row.id === id);
      if (!target) return;
      const children = [...(target.children || [[], [], []])];
      children[Number(column)] = [...(children[Number(column)] || []), block];
      next = updateBlock(next, id, { children });
    }
    change(next);
  };
  const move = (rows: SiteBlock[], index: number, direction: number) => {
    const next = [...rows];
    const target = index + direction;
    if (target >= 0 && target < next.length)
      [next[index], next[target]] = [next[target], next[index]];
    return next;
  };
  const render = (
    rows: SiteBlock[],
    setRows: (rows: SiteBlock[]) => void,
    nested = false,
  ) => (
    <>
      {rows.map((block, index) => {
        const patch = (value: Partial<SiteBlock>) => patchById(block.id, value);
        return (
          <article
            className="page-block-card"
            key={block.id}
            data-block-card={block.id}
          >
            <div className="page-block-heading">
              <strong>
                {
                  {
                    text: "Texto",
                    image: "Fotografía",
                    video: "Vídeo",
                    columns: "Columnas",
                  }[block.type]
                }
              </strong>
              <span />
              <button
                type="button"
                aria-label="Subir bloque"
                disabled={!index}
                onClick={() => setRows(move(rows, index, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Bajar bloque"
                disabled={index === rows.length - 1}
                onClick={() => setRows(move(rows, index, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Eliminar este bloque del borrador?"))
                    setRows(rows.filter((row) => row.id !== block.id));
                }}
              >
                Eliminar
              </button>
            </div>
            {block.type !== "columns" && (
              <label>
                Mover a
                <select
                  aria-label="Mover bloque a columna"
                  value="choose"
                  onChange={(e) => transfer(block, e.target.value)}
                >
                  <option value="choose" disabled>
                    Elegir ubicación…
                  </option>
                  <option value="">Fuera de columnas</option>
                  {blocks
                    .filter((row) => row.type === "columns")
                    .flatMap((row, rowIndex) =>
                      Array.from({ length: row.columns || 2 }, (_, column) => (
                        <option
                          key={`${row.id}:${column}`}
                          value={`${row.id}:${column}`}
                        >
                          Bloque de columnas {rowIndex + 1} · Columna{" "}
                          {column + 1}
                        </option>
                      )),
                    )}
                </select>
              </label>
            )}
            {!nested && (
              <div className="page-block-placement">
                <label>
                  Ubicación
                  <select
                    aria-label="Ubicación del bloque"
                    value={block.anchor || ""}
                    onChange={(e) => patch({ anchor: e.target.value })}
                  >
                    <option value="">Al final de la página</option>
                    {[
                      ...new Set(
                        fields
                          .filter((f) => f.document.startsWith("page-"))
                          .map((f) => f.section),
                      ),
                    ].map((section) => (
                      <option key={section} value={`section:${section}`}>
                        Sección: {section}
                      </option>
                    ))}
                    {fields
                      .filter(
                        (f) =>
                          f.kind === "text" && f.document.startsWith("page-"),
                      )
                      .map((f) => (
                        <option key={f.id} value={`text:${f.id}`}>
                          {f.label.slice(0, 95)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Posición
                  <select
                    value={block.position || "after"}
                    onChange={(e) =>
                      patch({ position: e.target.value as "before" | "after" })
                    }
                  >
                    <option value="after">Después</option>
                    <option value="before">Antes</option>
                  </select>
                </label>
              </div>
            )}
            {block.type === "text" && (
              <>
                <div className="page-block-design">
                  <label>
                    Tamaño
                    <select
                      aria-label="Tamaño de letra del bloque"
                      value={block.size || 18}
                      onChange={(e) => patch({ size: Number(e.target.value) })}
                    >
                      {[12, 14, 16, 18, 20, 24, 32, 40, 48, 64].map((size) => (
                        <option value={size} key={size}>
                          {size} px
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tipografía
                    <select
                      aria-label="Tipografía del bloque"
                      value={block.font || "site"}
                      onChange={(e) =>
                        patch({ font: e.target.value as SiteBlock["font"] })
                      }
                    >
                      <option value="site">La del sitio</option>
                      <option value="sans">Arial</option>
                      <option value="georgia">Georgia</option>
                    </select>
                  </label>
                  <label>
                    Alineación
                    <select
                      value={block.align || "left"}
                      onChange={(e) =>
                        patch({ align: e.target.value as SiteBlock["align"] })
                      }
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                  </label>
                </div>
                <RichBlock block={block} change={patch} />
              </>
            )}
            {block.type === "columns" && (
              <>
                <label>
                  Número de columnas
                  <select
                    aria-label="Número de columnas"
                    value={block.columns || 2}
                    onChange={(e) => {
                      const count = Number(e.target.value),
                        children = [...(block.children || [[], [], []])];
                      if (count === 2 && children[2]?.length) {
                        children[1] = [...(children[1] || []), ...children[2]];
                        children[2] = [];
                      }
                      patch({ columns: count, children });
                    }}
                  >
                    <option value="2">2 columnas</option>
                    <option value="3">3 columnas</option>
                  </select>
                </label>
                <div
                  className="page-block-columns"
                  style={{
                    gridTemplateColumns: `repeat(${block.columns || 2}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: block.columns || 2 }, (_, col) => (
                    <div key={col}>
                      <strong>Columna {col + 1}</strong>
                      {render(
                        block.children?.[col] || [],
                        (children) => {
                          const current = flattenBlocks(latest.current).find(
                            (b) => b.id === block.id,
                          );
                          const all = [...(current?.children || [[], [], []])];
                          all[col] = children;
                          patch({ children: all });
                        },
                        true,
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {["image", "video"].includes(block.type) && (
              <div className="page-block-media">
                <label>
                  {block.type === "video"
                    ? "Importar vídeo MP4 / WebM · hasta 50 MB"
                    : "Importar fotografía · JPG, PNG, WebP o AVIF"}
                  <input
                    aria-label={
                      block.type === "video"
                        ? "Importar vídeo"
                        : "Importar fotografía"
                    }
                    type="file"
                    accept={
                      block.type === "video"
                        ? "video/mp4,video/webm"
                        : "image/jpeg,image/png,image/webp,image/avif"
                    }
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const input = e.target;
                      input.disabled = true;
                      try {
                        const src = await upload(file);
                        patch({ src });
                      } catch (error) {
                        notify((error as Error).message);
                      } finally {
                        input.disabled = false;
                        input.value = "";
                      }
                    }}
                  />
                </label>
                <label>
                  {block.type === "video"
                    ? "O enlace de YouTube, Vimeo o vídeo HTTPS"
                    : "O dirección HTTPS de la fotografía"}
                  <input
                    aria-label="Dirección del archivo"
                    value={block.src || ""}
                    onChange={(e) => patch({ src: e.target.value })}
                    placeholder="https://…"
                  />
                </label>
                {block.type === "image" && (
                  <>
                    <label>
                      Descripción de la imagen
                      <input
                        value={block.alt || ""}
                        onChange={(e) => patch({ alt: e.target.value })}
                      />
                    </label>
                    {block.src && (
                      <img
                        src={
                          block.src.startsWith("cms:")
                            ? `/api/admin/site/asset/${block.src.slice(4)}`
                            : /^https:\/\//.test(block.src) ||
                                block.src.startsWith("/")
                              ? block.src
                              : ""
                        }
                        alt={block.alt || ""}
                      />
                    )}
                  </>
                )}
                {block.type === "video" && block.src?.startsWith("cms:") && (
                  <video
                    src={`/api/admin/site/asset/${block.src.slice(4)}`}
                    controls
                    preload="metadata"
                  />
                )}
                <label>
                  Pie de {block.type === "image" ? "foto" : "vídeo"}
                  <input
                    value={block.caption || ""}
                    onChange={(e) => patch({ caption: e.target.value })}
                  />
                </label>
              </div>
            )}
          </article>
        );
      })}
      <div
        className="page-block-add"
        role="group"
        aria-label="Añadir contenido"
      >
        {(
          [
            "text",
            "image",
            "video",
            ...(nested ? [] : ["columns"]),
          ] as SiteBlock["type"][]
        ).map((type) => (
          <button
            className="nd-button"
            type="button"
            key={type}
            onClick={() => setRows([...rows, newBlock(type)])}
          >
            +{" "}
            {
              {
                text: "Texto",
                image: "Foto",
                video: "Vídeo",
                columns: "Columnas",
              }[type]
            }
          </button>
        ))}
      </div>
    </>
  );
  return (
    <div className="page-blocks-editor">
      <h2>Bloques y columnas</h2>
      <p>
        Añade contenido, elige dónde aparece y revisa el resultado en Editor
        visual. Se guarda para todo el equipo. Publicar página lo muestra en el
        sitio.
      </p>
      {render(blocks, change)}
    </div>
  );
}
