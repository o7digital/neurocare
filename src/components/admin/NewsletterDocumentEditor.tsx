// Ported from o7digital/crm-suites-o7, crm-suitesmine dev bfd0ce3, admin/mail/page.tsx.
import type * as React from "react";
import type {
  NewsletterCampaign,
  NewsletterEvent,
  MailchimpSetup,
  PreviewMode,
} from "./types";
import {
  paragraphsToRichHtml,
  sanitizeRichHtml,
  previewMergeTags,
} from "../../../backend/newsletter.mjs";
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
export default function NewsletterDocumentEditor({
  campaign,
  setup,
  patchCampaign,
  patchEvent,
  addEvent,
  removeEvent,
  onClose,
  onSave,
  onPublish,
  busy,
}: {
  campaign: NewsletterCampaign;
  setup: MailchimpSetup;
  patchCampaign: (patch: Partial<NewsletterCampaign>) => void;
  patchEvent: (index: number, patch: Partial<NewsletterEvent>) => void;
  addEvent: () => void;
  removeEvent: (index: number) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onPublish: () => Promise<void>;
  busy: "save" | "test" | "publish" | null;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        },
      }),
    ],
    content: campaign.bodyHtml || paragraphsToRichHtml(campaign.body),
    editorProps: {
      attributes: {
        class: "newsletter-doc-prose",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      patchCampaign({
        bodyHtml: currentEditor.getHTML(),
        body: currentEditor.getText({ blockSeparator: "\n\n" }),
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(
      campaign.bodyHtml || paragraphsToRichHtml(campaign.body),
      { emitUpdate: false },
    );
    // The editor is deliberately reset only when a different newsletter is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, editor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (busy === null) void onSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSave, busy]);

  const setLink = () => {
    if (!editor) return;
    const previous = String(editor.getAttributes("link").href || "");
    const url = window.prompt("Dirección del enlace", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  };

  const wordCount = editor?.getText().trim()
    ? editor.getText().trim().split(/\s+/).length
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#e9e9ed] text-[#202124]">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-black/10 bg-[#402b35] px-4 py-2 text-white shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm hover:bg-white/10"
          >
            ← Volver
          </button>
          <div className="min-w-0 border-l border-white/15 pl-4">
            <input
              aria-label="Nombre del documento"
              className="w-full min-w-0 bg-transparent text-base font-semibold text-white outline-none sm:w-[360px]"
              value={`Neuro Diversa · ${campaign.month} ${campaign.year}`}
              readOnly
            />
            <p className="mt-0.5 text-[11px] text-[#d7c6a3]">
              Documento editable · Cmd/Ctrl + S para guardar
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
            onClick={onSave}
            disabled={busy !== null}
          >
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#dfb85f] px-4 py-2 text-sm font-semibold text-[#17231e]"
            onClick={onPublish}
            disabled={busy !== null}
          >
            {busy === "publish" ? "Creando…" : "Crear en Mailchimp"}
          </button>
        </div>
      </header>

      <div className="flex min-h-14 flex-wrap items-center gap-1 border-b border-black/10 bg-white px-3 py-2 shadow-sm sm:px-6">
        <ToolbarButton
          label="Deshacer"
          active={false}
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          label="Rehacer"
          active={false}
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
        >
          ↷
        </ToolbarButton>
        <span className="mx-2 h-7 w-px bg-black/10" />
        <select
          aria-label="Estilo del párrafo"
          className="h-9 rounded-md border border-black/10 bg-white px-3 text-sm outline-none hover:bg-black/[0.03]"
          value={
            editor?.isActive("heading", { level: 2 })
              ? "h2"
              : editor?.isActive("heading", { level: 3 })
                ? "h3"
                : "p"
          }
          onChange={(event) => {
            if (!editor) return;
            if (event.target.value === "h2")
              editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (event.target.value === "h3")
              editor.chain().focus().toggleHeading({ level: 3 }).run();
            else editor.chain().focus().setParagraph().run();
          }}
        >
          <option value="p">Texto normal</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
        </select>
        <span className="mx-2 h-7 w-px bg-black/10" />
        <ToolbarButton
          label="Negrita"
          active={Boolean(editor?.isActive("bold"))}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          label="Cursiva"
          active={Boolean(editor?.isActive("italic"))}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          label="Subrayado"
          active={Boolean(editor?.isActive("underline"))}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          label="Enlace"
          active={Boolean(editor?.isActive("link"))}
          onClick={setLink}
        >
          🔗
        </ToolbarButton>
        <span className="mx-2 h-7 w-px bg-black/10" />
        <ToolbarButton
          label="Lista con viñetas"
          active={Boolean(editor?.isActive("bulletList"))}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          • Liste
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={Boolean(editor?.isActive("orderedList"))}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1. Liste
        </ToolbarButton>
        <ToolbarButton
          label="Cita"
          active={Boolean(editor?.isActive("blockquote"))}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          “ ”
        </ToolbarButton>
        <span className="ml-auto hidden text-xs text-[#5f6368] md:block">
          {wordCount} palabras
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-7 sm:px-8">
        <div className="mx-auto mb-4 max-w-[900px] rounded-lg border border-black/10 bg-white px-6 py-4 shadow-sm">
          <DocField
            label="Asunto"
            value={campaign.subject}
            onChange={(subject) => patchCampaign({ subject })}
          />
          <DocField
            label="Vista previa"
            value={campaign.preheader}
            onChange={(preheader) => patchCampaign({ preheader })}
            multiline
          />
        </div>

        <main className="mx-auto min-h-[1100px] max-w-[900px] bg-[#fffdf8] shadow-[0_3px_18px_rgba(0,0,0,0.16)]">
          <section className="grid min-h-[330px] md:grid-cols-2">
            <div className="flex flex-col justify-center px-12 py-12">
              <input
                className="w-full bg-transparent text-xs uppercase tracking-[0.28em] text-[#9a6678] outline-none"
                value={campaign.eyebrow}
                onChange={(event) =>
                  patchCampaign({ eyebrow: event.target.value })
                }
              />
              <textarea
                aria-label="Título principal"
                className="mt-6 min-h-40 w-full resize-none bg-transparent font-serif text-5xl leading-[1.08] text-[#402b35] outline-none"
                value={campaign.headline}
                onChange={(event) =>
                  patchCampaign({ headline: event.target.value })
                }
              />
            </div>
            <div className="relative min-h-80 bg-[#56404c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={campaign.heroImage || setup.heroImage}
                alt="Neuro Diversa"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute bottom-6 left-6 rounded-md bg-[#402b35]/95 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#e6c77d]">
                {campaign.month}
              </span>
            </div>
          </section>

          <section className="flex items-center justify-between gap-6 bg-[#402b35] px-12 py-7 text-[#f4ead7]">
            <div>
              <p className="font-serif text-3xl font-semibold">Neuro Diversa</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#d7c6a3]">
                Psiquiatría · Psicología · San Ángel
              </p>
            </div>
            <p className="text-right text-sm text-[#d7c6a3]">
              Haz clic en el documento para escribir
            </p>
          </section>

          <section className="px-12 py-12">
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-full bg-[#9a6678]/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#8a682f]">
                {campaign.month}
              </span>
              <span className="text-xs text-[#716554]">
                Contenido principal · editable
              </span>
            </div>
            <EditorContent editor={editor} className="newsletter-doc-editor" />
            <div className="mt-8 grid gap-3 rounded-xl border border-[#d8c8ad] bg-[#f8f0e2] p-5 sm:grid-cols-[220px_1fr]">
              <DocField
                label="Texto del botón"
                value={campaign.cta}
                onChange={(cta) => patchCampaign({ cta })}
              />
              <DocField
                label="Enlace del botón"
                value={campaign.ctaUrl}
                onChange={(ctaUrl) => patchCampaign({ ctaUrl })}
              />
            </div>
          </section>

          <section className="border-t border-[#e3d7c3] bg-[#f7f0e4] px-12 py-12">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#9a6678]">
                  Lecturas y experiencias
                </p>
                <h2 className="mt-2 font-serif text-3xl text-[#402b35]">
                  Agenda de {campaign.month.toLowerCase()}
                </h2>
              </div>
              <button
                type="button"
                onClick={addEvent}
                className="rounded-lg bg-[#87424d] px-4 py-2 text-xs font-semibold text-white"
              >
                + Añadir
              </button>
            </div>
            <div className="space-y-4">
              {campaign.events.map((event, index) => (
                <article
                  key={event.id}
                  className="overflow-hidden rounded-xl border border-[#d8c8ad] bg-white"
                >
                  {event.imageUrl ? (
                    <div className="border-b border-[#d8c8ad] bg-[#ece3d4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.imageUrl}
                        alt={`Imagen de ${event.title}`}
                        className="h-72 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="p-5">
                    <div className="grid gap-4 sm:grid-cols-[140px_1fr_auto]">
                      <div>
                        <DocField
                          label="Categoría"
                          value={event.category}
                          onChange={(category) =>
                            patchEvent(index, { category })
                          }
                          compact
                        />
                        <DocField
                          label="Fecha"
                          value={event.date}
                          onChange={(date) => patchEvent(index, { date })}
                          compact
                        />
                      </div>
                      <div>
                        <DocField
                          label="Actividad"
                          value={event.title}
                          onChange={(title) => patchEvent(index, { title })}
                          compact
                          prominent
                        />
                        <DocField
                          label="Lugar"
                          value={event.venue}
                          onChange={(venue) => patchEvent(index, { venue })}
                          compact
                        />
                        <DocField
                          label="Descripción"
                          value={event.description}
                          onChange={(description) =>
                            patchEvent(index, { description })
                          }
                          multiline
                          compact
                        />
                        <DocField
                          label="Sitio de referencia"
                          value={event.url}
                          onChange={(url) => patchEvent(index, { url })}
                          compact
                        />
                        <DocField
                          label="Imagen · URL HTTPS"
                          value={event.imageUrl || ""}
                          onChange={(imageUrl) =>
                            patchEvent(index, { imageUrl })
                          }
                          compact
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEvent(index)}
                        className="h-8 rounded-md px-2 text-xs text-red-600 hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <footer className="bg-[#402b35] px-12 py-8 text-sm text-[#f4ead7]">
            <strong>Neuro Diversa</strong>
            <p className="mt-2 text-xs leading-6 text-[#d7c6a3]">
              {setup.address} · {setup.phone} · {setup.replyTo}
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`h-9 min-w-9 rounded-md px-2 text-sm transition disabled:opacity-30 ${active ? "bg-[#dce8e2] text-[#17352a]" : "hover:bg-black/[0.05]"}`}
    >
      {children}
    </button>
  );
}

function DocField({
  label,
  value,
  onChange,
  multiline = false,
  compact = false,
  prominent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  compact?: boolean;
  prominent?: boolean;
}) {
  const shared = `w-full border-0 border-b border-transparent bg-transparent outline-none transition hover:border-black/10 focus:border-[#9a6678] ${
    prominent ? "font-serif text-xl text-[#402b35]" : "text-sm text-[#3d382f]"
  } ${compact ? "py-1" : "py-2"}`;
  return (
    <label className={`block ${compact ? "mb-2" : "mb-3 last:mb-0"}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8175]">
        {label}
      </span>
      {multiline ? (
        <textarea
          className={`${shared} min-h-16 resize-y`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={shared}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
