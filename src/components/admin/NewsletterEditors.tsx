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
export function ContentEditor({
  campaign,
  patchCampaign,
  resetCampaign,
}: {
  campaign: NewsletterCampaign;
  patchCampaign: (patch: Partial<NewsletterCampaign>) => void;
  resetCampaign: () => void;
}) {
  return (
    <div className="space-y-5">
      <EditorGroup
        title="Sobre del correo"
        description="Estos campos aparecen en la bandeja de entrada."
      >
        <Field
          label="Asunto"
          value={campaign.subject}
          onChange={(subject) => patchCampaign({ subject })}
          maxLength={160}
        />
        <TextArea
          label="Vista previa"
          value={campaign.preheader}
          onChange={(preheader) => patchCampaign({ preheader })}
          rows={3}
        />
      </EditorGroup>

      <EditorGroup
        title="Mensaje"
        description="Todos los cambios aparecen inmediatamente en la vista previa."
      >
        <Field
          label="Antetítulo"
          value={campaign.eyebrow}
          onChange={(eyebrow) => patchCampaign({ eyebrow })}
        />
        <Field
          label="Título principal"
          value={campaign.headline}
          onChange={(headline) => patchCampaign({ headline })}
        />
        <TextArea
          label="Cuerpo de la newsletter"
          value={campaign.body}
          onChange={(body) => patchCampaign({ body, bodyHtml: "" })}
          rows={12}
        />
        <p className="text-xs leading-5 text-slate-400">
          Variables disponibles: {"{{firstName}}"}, {"{{fullName}}"},{" "}
          {"{{company}}"} y {"{{email}}"}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Texto del botón"
            value={campaign.cta}
            onChange={(cta) => patchCampaign({ cta })}
          />
          <Field
            label="Enlace del botón"
            value={campaign.ctaUrl}
            onChange={(ctaUrl) => patchCampaign({ ctaUrl })}
          />
        </div>
      </EditorGroup>

      <EditorGroup
        title="Brief interno"
        description="Información interna para preparar la campaña."
      >
        <Field
          label="Periodo de envío"
          value={campaign.sendWindow}
          onChange={(sendWindow) => patchCampaign({ sendWindow })}
        />
        <TextArea
          label="Segmento"
          value={campaign.segment}
          onChange={(segment) => patchCampaign({ segment })}
          rows={3}
        />
        <TextArea
          label="Objetivo"
          value={campaign.goal}
          onChange={(goal) => patchCampaign({ goal })}
          rows={3}
        />
      </EditorGroup>

      <button
        className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        type="button"
        onClick={resetCampaign}
      >
        Restablecer plantilla
      </button>
    </div>
  );
}

export function EventsEditor({
  events,
  patchEvent,
  addEvent,
  removeEvent,
  moveEvent,
}: {
  events: NewsletterEvent[];
  patchEvent: (index: number, patch: Partial<NewsletterEvent>) => void;
  addEvent: () => void;
  removeEvent: (index: number) => void;
  moveEvent: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">
          Actividades y recursos
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Edita y ordena las actividades y los recursos de esta newsletter.
        </p>
      </div>
      {events.map((event, index) => (
        <details
          key={event.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          open={index === 0}
        >
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {event.title || `Actividad ${index + 1}`}
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {event.date || "Fecha por confirmar"}
                </p>
              </div>
              <span className="rounded-full bg-[#dfb85f]/10 px-2 py-1 text-[10px] uppercase text-[#e6c77d]">
                {event.category}
              </span>
            </div>
          </summary>
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            {event.imageUrl ? (
              <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.imageUrl}
                  alt={`Imagen de ${event.title}`}
                  className="h-48 w-full object-cover"
                />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Categoría"
                value={event.category}
                onChange={(category) => patchEvent(index, { category })}
              />
              <Field
                label="Fecha"
                value={event.date}
                onChange={(date) => patchEvent(index, { date })}
              />
            </div>
            <Field
              label="Título"
              value={event.title}
              onChange={(title) => patchEvent(index, { title })}
            />
            <Field
              label="Lugar"
              value={event.venue}
              onChange={(venue) => patchEvent(index, { venue })}
            />
            <TextArea
              label="Descripción"
              value={event.description}
              onChange={(description) => patchEvent(index, { description })}
              rows={4}
            />
            <Field
              label="Enlace oficial"
              value={event.url}
              onChange={(url) => patchEvent(index, { url })}
            />
            <Field
              label="URL de la imagen"
              value={event.imageUrl || ""}
              onChange={(imageUrl) => patchEvent(index, { imageUrl })}
            />
            <Field
              label="Nombre de la fuente"
              value={event.sourceLabel}
              onChange={(sourceLabel) => patchEvent(index, { sourceLabel })}
            />
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1 text-xs"
                type="button"
                onClick={() => moveEvent(index, -1)}
                disabled={index === 0}
              >
                Subir
              </button>
              <button
                className="btn-secondary flex-1 text-xs"
                type="button"
                onClick={() => moveEvent(index, 1)}
                disabled={index === events.length - 1}
              >
                Bajar
              </button>
              <button
                className="rounded-lg border border-red-400/20 px-3 text-xs text-red-200 hover:bg-red-400/10"
                type="button"
                onClick={() => removeEvent(index)}
              >
                Quitar
              </button>
            </div>
          </div>
        </details>
      ))}
      <button
        className="btn-secondary w-full text-sm"
        type="button"
        onClick={addEvent}
      >
        + Añadir actividad
      </button>
    </div>
  );
}

export function DesignEditor({
  campaign,
  setup,
  patchCampaign,
  setSetup,
}: {
  campaign: NewsletterCampaign;
  setup: MailchimpSetup;
  patchCampaign: (patch: Partial<NewsletterCampaign>) => void;
  setSetup: React.Dispatch<React.SetStateAction<MailchimpSetup>>;
}) {
  return (
    <div className="space-y-5">
      <EditorGroup
        title="Imagen principal"
        description="Elige una imagen de la biblioteca o utiliza una URL HTTPS."
      >
        <Field
          label="URL de la imagen"
          value={campaign.heroImage}
          onChange={(heroImage) => patchCampaign({ heroImage })}
        />
      </EditorGroup>
      <EditorGroup
        title="Puntos destacados"
        description="Ideas destacadas junto al mensaje."
      >
        {campaign.highlights.map((highlight, index) => (
          <Field
            key={index}
            label={`Destacado ${index + 1}`}
            value={highlight}
            onChange={(value) => {
              const highlights = [...campaign.highlights];
              highlights[index] = value;
              patchCampaign({ highlights });
            }}
          />
        ))}
      </EditorGroup>
      <EditorGroup title="Galería" description="Imágenes de esta campaña.">
        {setup.gallery.map((image, index) => (
          <Field
            key={index}
            label={`Imagen ${index + 1}`}
            value={image}
            onChange={(value) => {
              const gallery = [...setup.gallery];
              gallery[index] = value;
              setSetup((current) => ({ ...current, gallery }));
            }}
          />
        ))}
      </EditorGroup>
      <EditorGroup
        title="Datos de contacto"
        description="Pie de página de la newsletter."
      >
        <Field
          label="Dirección"
          value={setup.address}
          onChange={(address) =>
            setSetup((current) => ({ ...current, address }))
          }
        />
        <Field
          label="Teléfono"
          value={setup.phone}
          onChange={(phone) => setSetup((current) => ({ ...current, phone }))}
        />
        <Field
          label="Sitio web"
          value={setup.websiteUrl}
          onChange={(websiteUrl) =>
            setSetup((current) => ({ ...current, websiteUrl }))
          }
        />
      </EditorGroup>
    </div>
  );
}

export function MailchimpEditor({
  setup,
  setSetup,
  testConnection,
  busy,
}: {
  setup: MailchimpSetup;
  setSetup: React.Dispatch<React.SetStateAction<MailchimpSetup>>;
  testConnection: () => Promise<void>;
  busy: "save" | "test" | "publish" | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#dfb85f]/20 bg-[#dfb85f]/5 p-4 text-xs leading-5 text-slate-300">
        « Crear en Mailchimp » prepara un borrador con el diseño completo. El
        envío se confirma en Mailchimp.
      </div>
      <EditorGroup
        title="Cuenta Mailchimp"
        description="Las credenciales se guardan cifradas en el espacio privado."
      >
        <Field
          label="Nombre de la cuenta"
          value={setup.accountLabel}
          onChange={(accountLabel) =>
            setSetup((current) => ({ ...current, accountLabel }))
          }
        />
        <Field
          label="Clave API"
          type="password"
          value={setup.mailchimp.apiKey}
          onChange={(apiKey) =>
            setSetup((current) => ({
              ...current,
              mailchimp: { ...current.mailchimp, apiKey },
            }))
          }
          placeholder="••••••••••••••••-us21"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Prefijo del servidor"
            value={setup.mailchimp.serverPrefix}
            onChange={(serverPrefix) =>
              setSetup((current) => ({
                ...current,
                mailchimp: { ...current.mailchimp, serverPrefix },
              }))
            }
            placeholder="us21"
          />
          <Field
            label="ID de audiencia"
            value={setup.mailchimp.audienceId}
            onChange={(audienceId) =>
              setSetup((current) => ({
                ...current,
                mailchimp: { ...current.mailchimp, audienceId },
              }))
            }
          />
        </div>
      </EditorGroup>
      <EditorGroup
        title="Remitente"
        description="El dominio del remitente debe estar verificado en Mailchimp."
      >
        <Field
          label="Nombre"
          value={setup.fromName}
          onChange={(fromName) =>
            setSetup((current) => ({ ...current, fromName }))
          }
        />
        <Field
          label="Email"
          value={setup.fromEmail}
          onChange={(fromEmail) =>
            setSetup((current) => ({ ...current, fromEmail }))
          }
        />
        <Field
          label="Responder a"
          value={setup.replyTo}
          onChange={(replyTo) =>
            setSetup((current) => ({ ...current, replyTo }))
          }
        />
      </EditorGroup>
      <button
        className="btn-secondary w-full text-sm"
        type="button"
        onClick={testConnection}
        disabled={busy !== null}
      >
        {busy === "test" ? "Comprobando…" : "Guardar y comprobar conexión"}
      </button>
    </div>
  );
}

export function NewsletterPreview({
  campaign,
  setup,
  mode,
}: {
  campaign: NewsletterCampaign;
  setup: MailchimpSetup;
  mode: PreviewMode;
}) {
  const isMobile = mode === "mobile";
  const richBody = previewMergeTags(
    sanitizeRichHtml(campaign.bodyHtml || paragraphsToRichHtml(campaign.body)),
  );

  return (
    <div
      lang={campaign.language}
      className="overflow-auto rounded-xl border border-[#d6c8ad] bg-[#efe7d8] p-3 sm:p-5"
    >
      <div
        className={`mx-auto overflow-hidden rounded-lg bg-[#fbf8f1] text-[#1d1a16] shadow-2xl shadow-black/20 transition-all ${
          isMobile ? "max-w-[390px]" : "max-w-[820px]"
        }`}
      >
        <div className={isMobile ? "" : "grid md:grid-cols-2"}>
          <div className="flex min-h-72 flex-col justify-center px-8 py-9">
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a6678]">
              Neuro Diversa
            </p>
            <h2 className="mt-6 font-serif text-[42px] leading-[1.08] tracking-normal text-[#402b35]">
              {campaign.headline}
            </h2>
            <p className="mt-6 text-[15px] leading-7 text-[#716554]">
              {campaign.preheader}
            </p>
          </div>
          <div className="relative min-h-72 bg-[#56404c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.heroImage || setup.heroImage}
              alt="Neuro Diversa"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-5 left-5 rounded-md bg-[#402b35]/95 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#e6c77d]">
              {campaign.month}
            </span>
          </div>
        </div>

        <div
          className={`bg-[#402b35] px-8 py-6 text-[#f4ead7] ${isMobile ? "" : "flex items-center justify-between gap-6"}`}
        >
          <div>
            <p className="font-serif text-3xl font-semibold">Neuro Diversa</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#d7c6a3]">
              Psiquiatría · Psicología · San Ángel
            </p>
          </div>
          <p
            className={`max-w-sm text-sm leading-6 text-[#d7c6a3] ${isMobile ? "mt-4" : "text-right"}`}
          >
            {campaign.eyebrow}
          </p>
        </div>

        <div
          className={isMobile ? "" : "grid md:grid-cols-[minmax(0,1fr)_230px]"}
        >
          <section className="px-8 py-9">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a6678]">
              {campaign.month}
            </p>
            <h3 className="mt-3 font-serif text-3xl leading-tight text-[#402b35]">
              {campaign.subject}
            </h3>
            <div
              className="newsletter-preview-rich mt-6 text-[15px] leading-7 text-[#4c453b]"
              dangerouslySetInnerHTML={{ __html: richBody }}
            />
            <a
              href={campaign.ctaUrl || setup.reservationUrl}
              className="mt-7 inline-block rounded-md bg-[#87424d] px-6 py-3 text-sm font-semibold text-white"
            >
              {campaign.cta}
            </a>
          </section>
          <aside
            className={`bg-[#f3ead9] px-6 py-8 ${isMobile ? "border-t border-[#e3d7c3]" : "border-l border-[#e3d7c3]"}`}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a6678]">
              Incluye
            </p>
            <div className="mt-4 space-y-3">
              {campaign.highlights.map((item, index) => (
                <div
                  key={index}
                  className="rounded-md border border-[#d8c8ad] bg-white/55 p-3 text-sm leading-5 text-[#3d382f]"
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="border-t border-[#e3d7c3] bg-[#fffdf8] px-8 py-9">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a6678]">
            Lecturas y experiencias
          </p>
          <h3 className="mt-2 font-serif text-3xl text-[#402b35]">
            Actividades de {campaign.month.toLowerCase()}
          </h3>
          <div
            className={`mt-6 grid gap-4 ${!isMobile && campaign.events.length > 1 ? "sm:grid-cols-2" : ""}`}
          >
            {campaign.events.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-lg border border-[#ded1bc] bg-[#f8f0e2]"
              >
                {event.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.imageUrl}
                    alt={`Imagen de ${event.title}`}
                    className="h-40 w-full object-cover"
                  />
                ) : null}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98743a]">
                      {event.category}
                    </span>
                    <span className="text-right text-xs text-[#716554]">
                      {event.date}
                    </span>
                  </div>
                  <h4 className="mt-3 font-serif text-xl text-[#402b35]">
                    {event.title}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-[#6b5d49]">
                    {event.venue}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#5b5247]">
                    {event.description}
                  </p>
                  {event.url ? (
                    <a
                      href={event.url}
                      className="mt-4 inline-block text-xs font-semibold text-[#87424d] underline decoration-[#b5904e] underline-offset-4"
                    >
                      Consultar en {event.sourceLabel || "el sitio"}
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#e3d7c3] bg-[#f7f0e4] px-8 py-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {setup.gallery.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${image}-${index}`}
                src={image}
                alt={`Neuro Diversa ${index + 1}`}
                className="h-28 w-full rounded-lg border border-[#d8c8ad] object-cover"
              />
            ))}
          </div>
        </section>

        <footer className="bg-[#402b35] px-8 py-7 text-sm text-[#f4ead7]">
          <div
            className={
              isMobile ? "" : "flex items-center justify-between gap-4"
            }
          >
            <div>
              <p className="font-semibold">Neuro Diversa</p>
              <p className="mt-1 text-xs text-[#d7c6a3]">{setup.address}</p>
            </div>
            <div
              className={`text-xs text-[#d7c6a3] ${isMobile ? "mt-3" : "text-right"}`}
            >
              <p>{setup.phone}</p>
              <p>{setup.replyTo}</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "password";
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="flex items-center justify-between gap-3">
        {label}
        {maxLength ? (
          <span className="text-[10px] text-slate-500">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </span>
      <input
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[color:var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        type={type}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <textarea
        className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-[color:var(--accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
      />
    </label>
  );
}

function EditorGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold ${active ? "bg-white/10 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
    >
      {children}
    </button>
  );
}
