import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Mail,
  Plus,
  Save,
  Download,
  FilePenLine,
  Monitor,
  Smartphone,
  CalendarDays,
  LayoutTemplate,
  Images,
  ExternalLink,
  Share2,
  Layers,
  Check,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  ContentEditor,
  DesignEditor,
  EventsEditor,
  MailchimpEditor,
  NewsletterPreview,
} from "./NewsletterEditors";
import { api, formatDate, monthKey } from "./api";
import {
  brandSetup,
  newCampaign,
  normalizeCampaign,
  templates,
} from "./templates";
import { Badge, Empty, ImagePicker, Modal } from "./ui";
import {
  buildNewsletterHtml,
  toMailchimpText,
} from "../../../backend/newsletter.mjs";
import type {
  Workspace,
  NewsletterCampaign,
  NewsletterEvent,
  MailchimpSetup,
  PreviewMode,
} from "./types";
const DocumentEditor = lazy(() => import("./NewsletterDocumentEditor"));
type Props = {
  workspace: Workspace;
  refresh: () => Promise<Workspace>;
  notify: (text: string) => void;
  onSocial: () => void;
};
export default function NewsletterStudio({
  workspace,
  refresh,
  notify,
  onSocial,
}: Props) {
  const emails = workspace.campaigns.filter((c) => c.kind === "email");
  const [campaign, setCampaign] = useState<NewsletterCampaign>(() =>
      emails[0] ? normalizeCampaign(emails[0]) : newCampaign(),
    ),
    [tab, setTab] = useState("content"),
    [previewMode, setPreviewMode] = useState<PreviewMode>("desktop"),
    [modal, setModal] = useState<
      "templates" | "catalog" | "document" | "delivery" | null
    >(null),
    [busy, setBusy] = useState<"save" | "test" | "publish" | null>(null),
    [dirty, setDirty] = useState(false),
    [catalogQuery, setCatalogQuery] = useState(""),
    [testEmail, setTestEmail] = useState(""),
    [contacts, setContacts] = useState<
      Array<{
        id: string;
        first_name: string;
        email: string;
        opted_in: number;
        opted_out: number;
      }>
    >([]),
    [recipients, setRecipients] = useState<string[]>([]);
  const [setup, setSetup] = useState<MailchimpSetup>(
    () =>
      ({
        ...brandSetup,
        ...workspace.marketingSetup,
        ...campaign.design,
        ...workspace.connections.mailchimp,
        mailchimp: {
          ...brandSetup.mailchimp,
          ...workspace.connections.mailchimp,
          apiKey: "",
        },
      }) as MailchimpSetup,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width:720px)");
    const update = () => setPreviewMode(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const currentRef = useRef(campaign);
  currentRef.current = campaign;
  const patchCampaign = (patch: Partial<NewsletterCampaign>) => {
    setCampaign((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const patchEvent = (index: number, patch: Partial<NewsletterEvent>) =>
    patchCampaign({
      events: campaign.events.map((e, i) =>
        i === index ? { ...e, ...patch } : e,
      ),
    });
  const addEvent = () =>
    patchCampaign({
      events: [
        ...campaign.events,
        {
          id: crypto.randomUUID(),
          category: "Actividad",
          title: "Nueva actividad",
          date: "Por confirmar",
          venue: "San Ángel, CDMX",
          description: "",
          url: "https://neurodiversa.mx",
          sourceLabel: "Neuro Diversa",
          imageUrl: "",
          language: campaign.language,
        },
      ],
    });
  const design = () => ({
    heroImage: setup.heroImage,
    gallery: setup.gallery,
    address: setup.address,
    phone: setup.phone,
    websiteUrl: setup.websiteUrl,
    reservationUrl: setup.reservationUrl,
  });
  const save = async () => {
    const snapshot = currentRef.current;
    const document = { ...snapshot, design: design() };
    const result = await api<{ id: string; version: number }>(
      "admin/campaigns",
      document,
    );
    const saved = { ...document, id: result.id, version: result.version };
    if (currentRef.current === snapshot) {
      currentRef.current = saved;
      setCampaign(saved);
      setDirty(false);
    } else {
      const newer = {
        ...currentRef.current,
        id: result.id,
        version: result.version,
      };
      currentRef.current = newer;
      setCampaign(newer);
      setDirty(true);
    }
    await refresh();
    return saved;
  };
  const perform = async (
    task: () => Promise<void>,
    state: "save" | "test" | "publish" = "save",
  ) => {
    setBusy(state);
    try {
      await task();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: Event) => {
      if (
        dirty &&
        !window.confirm(
          "Hay cambios sin guardar. ¿Quieres salir de esta campaña?",
        )
      )
        event.preventDefault();
    };
    window.addEventListener("neurodiversa:before-navigation", navigate);
    window.addEventListener("beforeunload", prevent);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      window.removeEventListener("neurodiversa:before-navigation", navigate);
    };
  }, [dirty]);
  const select = (doc: NewsletterCampaign) => {
    if (
      dirty &&
      !window.confirm("Hay cambios sin guardar. ¿Quieres abrir otra campaña?")
    )
      return;
    const next = normalizeCampaign(doc);
    setCampaign(next);
    currentRef.current = next;
    setSetup((s) => ({ ...s, ...workspace.marketingSetup, ...next.design }));
    setDirty(false);
  };
  const create = (template: string) => {
    const next = newCampaign(template, campaign.monthKey);
    setCampaign(next);
    currentRef.current = next;
    setDirty(true);
    setModal(null);
  };
  const persistMailchimp = async () => {
    await api(
      "admin/connections",
      {
        mailchimp: {
          ...setup.mailchimp,
          accountLabel: setup.accountLabel,
          fromName: setup.fromName,
          fromEmail: setup.fromEmail,
          replyTo: setup.replyTo || setup.fromEmail,
        },
      },
      "PATCH",
    );
    await refresh();
    setSetup((s) => ({ ...s, mailchimp: { ...s.mailchimp, apiKey: "" } }));
  };
  const publishMailchimp = async () => {
    if (
      !workspace.connections.mailchimp?.configured &&
      (!setup.mailchimp.apiKey ||
        !setup.fromEmail ||
        !setup.mailchimp.serverPrefix ||
        !setup.mailchimp.audienceId)
    ) {
      setTab("mailchimp");
      notify(
        "Completa la conexión Mailchimp para crear el borrador. Puedes seguir diseñando y guardando tu newsletter.",
      );
      return;
    }
    await perform(async () => {
      const saved = await save();
      if (
        !workspace.connections.mailchimp?.configured ||
        setup.mailchimp.apiKey
      )
        await persistMailchimp();
      const result = await api<{ results: Array<{ status: string }> }>(
        `admin/campaigns/${saved.id}/mailchimp`,
        { version: saved.version, confirmed: true },
      );
      notify(
        result.results[0]?.status === "already_recorded"
          ? "Este borrador ya está registrado. Consulta el historial."
          : "Borrador en preparación. Su estado aparecerá en el historial.",
      );
      await refresh();
    }, "publish");
  };
  const publication = workspace.publications.find(
    (p) => p.campaign_id === campaign.id,
  );
  const campaignDeliveries = workspace.deliveries.filter(
    (d) => d.campaign_id === campaign.id,
  );
  const monthGroups = [
    ...new Set([
      campaign.monthKey,
      ...emails.map((c) => c.monthKey || monthKey()),
    ]),
  ].sort();
  const download = () => {
    const blob = new Blob(
        [toMailchimpText(buildNewsletterHtml(campaign, setup))],
        { type: "text/html;charset=utf-8" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `neuro-diversa-${campaign.monthKey}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="studio-view">
      <div className="studio-heading">
        <div>
          <span className="eyebrow">COMUNICACIÓN · ESTUDIO DE CAMPAÑAS</span>
          <h1>Mailing & newsletters</h1>
          <p>Un documento, tu diseño y todos tus canales.</p>
        </div>
        <button
          className="nd-button gold"
          onClick={() => setModal("templates")}
        >
          <Plus size={16} />
          Nueva campaña
        </button>
      </div>
      <div className="campaign-strip">
        <div className="month-switch">
          <CalendarDays size={16} />
          <label className="sr-only" htmlFor="campaign-month">
            Mes de campaña
          </label>
          <input
            id="campaign-month"
            type="month"
            value={campaign.monthKey}
            onChange={(e) => {
              if (!e.target.value) return;
              const date = new Date(`${e.target.value}-15T12:00:00`);
              patchCampaign({
                monthKey: e.target.value,
                month: date.toLocaleDateString("es-MX", { month: "long" }),
                year: Number(e.target.value.slice(0, 4)),
              });
            }}
          />
        </div>
        <label className="campaign-language">
          <span className="sr-only">Idioma de la newsletter</span>
          <select
            value={campaign.language}
            onChange={(e) =>
              patchCampaign({ language: e.target.value as "es" | "en" })
            }
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </label>
        <div className="campaign-tabs">
          {emails
            .filter((c) => (c.monthKey || monthKey()) === campaign.monthKey)
            .map((c) => (
              <button
                key={c.id}
                className={campaign.id === c.id ? "active" : ""}
                onClick={() => select(c)}
              >
                <Mail size={14} />
                <span>{c.subject}</span>
              </button>
            ))}
          {!campaign.version && (
            <span className="unsaved-tab">
              <Mail size={14} /> Nueva campaña
            </span>
          )}
        </div>
        <button
          className="nd-button ghost"
          onClick={() => setModal("templates")}
        >
          <LayoutTemplate size={15} />
          Plantillas
        </button>
      </div>
      <div className="studio-toolbar">
        <div>
          <Badge value={campaign.status} />
          <span className="save-indicator">
            {dirty ? (
              <>
                <i />
                Cambios sin guardar
              </>
            ) : campaign.version ? (
              <>
                <Check size={13} />
                Versión {campaign.version}
              </>
            ) : (
              "Plantilla de inicio"
            )}
          </span>
        </div>
        <div>
          <button className="nd-button" onClick={() => setModal("catalog")}>
            <Layers size={15} />
            Catálogo
          </button>
          <button className="nd-button" onClick={download}>
            <Download size={15} />
            HTML
          </button>
          <button className="nd-button" onClick={() => setModal("document")}>
            <FilePenLine size={15} />
            Editar documento
          </button>
          <button
            className="nd-button gold"
            disabled={busy !== null}
            onClick={() =>
              void perform(async () => {
                await save();
                notify("Campaña guardada.");
              })
            }
          >
            <Save size={15} />
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
          <button
            className="nd-button primary"
            disabled={busy !== null}
            onClick={() => void publishMailchimp()}
          >
            <Mail size={15} />
            {busy === "publish" ? "Preparando…" : "Crear en Mailchimp"}
          </button>
        </div>
      </div>
      <div className="newsletter-grid">
        <section className="newsletter-preview-pane">
          <div className="preview-chrome">
            <div>
              <span className="live-dot online" />
              <span>Vista previa en vivo</span>
            </div>
            <div>
              <button
                aria-label="Vista de escritorio"
                aria-pressed={previewMode === "desktop"}
                className={previewMode === "desktop" ? "active" : ""}
                onClick={() => setPreviewMode("desktop")}
              >
                <Monitor size={16} />
              </button>
              <button
                aria-label="Vista móvil"
                aria-pressed={previewMode === "mobile"}
                className={previewMode === "mobile" ? "active" : ""}
                onClick={() => setPreviewMode("mobile")}
              >
                <Smartphone size={16} />
              </button>
            </div>
          </div>
          <div className="email-envelope">
            <span>ASUNTO</span>
            <strong>{campaign.subject}</strong>
            <p>{campaign.preheader}</p>
          </div>
          <NewsletterPreview
            campaign={campaign}
            setup={setup}
            mode={previewMode}
          />
        </section>
        <aside className="newsletter-editor dark-editor">
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Editar newsletter"
          >
            {[
              ["content", "Contenido"],
              ["events", "Actividades"],
              ["design", "Diseño"],
              ["mailchimp", "Mailchimp"],
            ].map(([id, label]) => (
              <button
                id={`tab-${id}`}
                key={id}
                role="tab"
                aria-controls="newsletter-editor-panel"
                aria-selected={tab === id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="newsletter-editor-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            className="editor-scroll"
          >
            {tab === "content" && (
              <ContentEditor
                campaign={campaign}
                patchCampaign={patchCampaign}
                resetCampaign={() => {
                  if (
                    window.confirm("¿Restablecer el contenido de esta campaña?")
                  ) {
                    const { id, version, monthKey: month, year } = campaign;
                    setCampaign({
                      ...newCampaign("group", month),
                      id,
                      version,
                      year,
                    });
                    setDirty(true);
                  }
                }}
              />
            )}{" "}
            {tab === "events" && (
              <>
                <EventsEditor
                  events={campaign.events}
                  patchEvent={patchEvent}
                  addEvent={addEvent}
                  removeEvent={(index) =>
                    patchCampaign({
                      events: campaign.events.filter((_, i) => i !== index),
                    })
                  }
                  moveEvent={(index, direction) => {
                    const events = [...campaign.events];
                    [events[index], events[index + direction]] = [
                      events[index + direction],
                      events[index],
                    ];
                    patchCampaign({ events });
                  }}
                />
                {campaign.events.map((event, index) => (
                  <div key={event.id} className="event-image-row">
                    <span>{event.title}</span>
                    <ImagePicker
                      value={event.imageUrl || ""}
                      onChange={(imageUrl) => patchEvent(index, { imageUrl })}
                      workspace={workspace}
                      refresh={refresh}
                    />
                    <button
                      className="nd-button"
                      onClick={() =>
                        void perform(async () => {
                          await api("admin/catalog", {
                            ...event,
                            version: workspace.catalog.find(
                              (e) => e.id === event.id,
                            )?.version,
                          });
                          await refresh();
                          notify("Actividad guardada en el catálogo.");
                        })
                      }
                    >
                      Guardar en catálogo
                    </button>
                  </div>
                ))}
              </>
            )}
            {tab === "design" && (
              <>
                <ImagePicker
                  value={campaign.heroImage}
                  onChange={(heroImage) => patchCampaign({ heroImage })}
                  workspace={workspace}
                  refresh={refresh}
                />
                <DesignEditor
                  campaign={campaign}
                  setup={setup}
                  patchCampaign={patchCampaign}
                  setSetup={(update) => {
                    setSetup(update);
                    setDirty(true);
                  }}
                />
              </>
            )}
            {tab === "mailchimp" &&
              (workspace.user.role === "owner" ? (
                <MailchimpEditor
                  setup={setup}
                  setSetup={setSetup}
                  busy={busy}
                  testConnection={async () => {
                    await perform(async () => {
                      await persistMailchimp();
                      await api("admin/mailchimp/test", {});
                      notify("Conexión Mailchimp comprobada.");
                    }, "test");
                  }}
                />
              ) : (
                <p>La administración gestiona la conexión Mailchimp.</p>
              ))}
          </div>
        </aside>
      </div>
      <div className="campaign-operations">
        <section className="operation-card">
          <div className="operation-title">
            <Share2 size={18} />
            <div>
              <h2>Agenda pública</h2>
              <p>Comparte una versión aprobada en el sitio.</p>
            </div>
          </div>
          {publication ? (
            <>
              <a
                className="public-link"
                href={`/agenda/?id=${publication.id}`}
                target="_blank"
                rel="noreferrer"
              >
                neurodiversa.mx/agenda/ <ExternalLink size={14} />
              </a>
              <p className="muted">
                Versión {publication.version} ·{" "}
                {formatDate(publication.updated)}
              </p>
            </>
          ) : (
            <p className="muted">
              Esta campaña todavía no tiene una versión pública.
            </p>
          )}
          <div className="button-row">
            <button
              className="nd-button"
              disabled={!!busy}
              onClick={() =>
                void perform(async () => {
                  const doc = await save();
                  await api(`admin/campaigns/${doc.id}/publish`, {
                    version: doc.version,
                  });
                  await refresh();
                  notify("Agenda publicada en el sitio.");
                })
              }
            >
              {publication ? "Actualizar versión pública" : "Publicar agenda"}
            </button>
            {publication && (
              <button
                className="nd-button ghost"
                onClick={() =>
                  void perform(async () => {
                    await api(
                      `admin/publications/${publication.id}`,
                      undefined,
                      "DELETE",
                    );
                    await refresh();
                    notify("Agenda retirada del enlace público.");
                  })
                }
              >
                Retirar
              </button>
            )}
          </div>
        </section>
        <section className="operation-card">
          <div className="operation-title">
            <Layers size={18} />
            <div>
              <h2>De newsletter a redes</h2>
              <p>Prepara un borrador por actividad, con su imagen y enlace.</p>
            </div>
          </div>
          <div className="month-overview">
            {monthGroups.slice(-4).map((month) => (
              <span key={month}>
                <strong>{month}</strong>
                <small>
                  {emails.filter((c) => c.monthKey === month).length} newsletter
                  ·{" "}
                  {
                    workspace.campaigns.filter(
                      (c) => c.kind === "social" && c.monthKey === month,
                    ).length
                  }{" "}
                  posts
                </small>
              </span>
            ))}
          </div>
          <button
            className="nd-button"
            disabled={!!busy || !campaign.events.length}
            onClick={() =>
              void perform(async () => {
                const doc = await save();
                const r = await api<{ created: string[] }>(
                  `admin/campaigns/${doc.id}/prepare-social`,
                  { version: doc.version },
                );
                await refresh();
                notify(
                  `${r.created.length} borrador(es) preparado(s). Los existentes se conservan.`,
                );
                onSocial();
              })
            }
          >
            Preparar en Buffer Studio <ArrowRight size={15} />
          </button>
        </section>
        <section className="operation-card">
          <div className="operation-title">
            <Mail size={18} />
            <div>
              <h2>Envíos y borradores</h2>
              <p>Seguimiento de esta campaña.</p>
            </div>
          </div>
          {campaignDeliveries.length ? (
            <div className="compact-history">
              {campaignDeliveries.slice(0, 5).map((d) => (
                <div key={d.id}>
                  <span>
                    {d.provider === "mailchimp" ? "Mailchimp" : d.target}
                  </span>
                  <Badge value={d.status} />
                  {d.remote_id && <small>ID {d.remote_id}</small>}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              Aún no se ha enviado ni creado un borrador externo.
            </p>
          )}
          <div className="button-row">
            <button
              className="nd-button"
              onClick={() =>
                void perform(async () => {
                  const data = await api<{ contacts: typeof contacts }>(
                    "admin/contacts",
                  );
                  setContacts(
                    data.contacts.filter((c) => c.opted_in && !c.opted_out),
                  );
                  setModal("delivery");
                })
              }
            >
              Envío por SMTP
            </button>
            <button
              className="nd-button ghost"
              aria-label="Actualizar envíos"
              onClick={() => void refresh().catch((e) => notify(e.message))}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </section>
      </div>
      {modal === "templates" && (
        <Modal title="Elige una plantilla" onClose={() => setModal(null)} wide>
          <p className="modal-description">
            Diseños editables con el contenido de Neuro Diversa. Se crean como
            borradores.
          </p>
          <div className="template-grid">
            {templates.map((template, index) => (
              <button key={template.id} onClick={() => create(template.id)}>
                <div className={`template-thumbnail template-${index}`}>
                  <span>NEURO DIVERSA</span>
                  <strong>{template.title}</strong>
                  <i />
                  <i />
                  <i />
                  <span className="mini-cta">Conocer más →</span>
                </div>
                <div>
                  <small>{template.tag}</small>
                  <h3>{template.title}</h3>
                  <p>{template.description}</p>
                  <span className="template-action">
                    Usar plantilla <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {emails.length > 0 && (
            <>
              <h3 className="library-title">Campañas guardadas</h3>
              <div className="saved-campaigns">
                {emails.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      select(c);
                      setModal(null);
                    }}
                  >
                    <Mail size={16} />
                    <span>
                      <strong>{c.subject}</strong>
                      <small>
                        {c.month} {c.year} · Versión {c.version}
                      </small>
                    </span>
                    <Badge value={c.status || "DRAFT"} />
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
      {modal === "catalog" && (
        <Modal
          title="Catálogo de actividades y recursos"
          onClose={() => setModal(null)}
          wide
        >
          <input
            className="catalog-search"
            aria-label="Buscar en catálogo"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Buscar una actividad, recurso o lugar…"
          />
          {workspace.catalog.length ? (
            <div className="catalog-grid">
              {workspace.catalog
                .filter((e) =>
                  `${e.title} ${e.category}`
                    .toLowerCase()
                    .includes(catalogQuery.toLowerCase()),
                )
                .map((event) => (
                  <article key={event.id}>
                    {event.imageUrl && <img src={event.imageUrl} alt="" />}
                    <div>
                      <span className="eyebrow">{event.category}</span>
                      <h3>{event.title}</h3>
                      <p>
                        {event.date} · {event.venue}
                      </p>
                      <button
                        className="nd-button"
                        disabled={campaign.events.some(
                          (e) => e.id === event.id,
                        )}
                        onClick={() =>
                          patchCampaign({ events: [...campaign.events, event] })
                        }
                      >
                        {campaign.events.some((e) => e.id === event.id)
                          ? "Incluida"
                          : "Añadir a la newsletter"}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              icon={CalendarDays}
              title="Tu catálogo está listo para crecer"
            >
              Guarda una actividad desde la pestaña Actividades para
              reutilizarla en otras campañas.
            </Empty>
          )}
        </Modal>
      )}
      {modal === "document" && (
        <Modal title="Editar documento" onClose={() => setModal(null)} wide>
          <Suspense fallback={<p>Cargando editor…</p>}>
            <DocumentEditor
              campaign={campaign}
              setup={setup}
              patchCampaign={patchCampaign}
              patchEvent={patchEvent}
              addEvent={addEvent}
              removeEvent={(index) =>
                patchCampaign({
                  events: campaign.events.filter((_, i) => i !== index),
                })
              }
              onClose={() => setModal(null)}
              onSave={async () => {
                await perform(async () => {
                  await save();
                  notify("Documento guardado.");
                });
              }}
              onPublish={publishMailchimp}
              busy={busy}
            />
          </Suspense>
        </Modal>
      )}
      {modal === "delivery" && (
        <Modal title="Revisar envío por SMTP" onClose={() => setModal(null)}>
          <p className="modal-description">
            {workspace.connections.smtp?.configured
              ? "Elige una prueba o los suscriptores autorizados. El envío usa la versión que guardes aquí."
              : "El remitente SMTP se puede configurar más adelante en Conexiones."}
          </p>
          <label className="nd-field">
            Correo de prueba
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </label>
          <button
            className="nd-button"
            disabled={
              !!busy || !testEmail || !workspace.connections.smtp?.configured
            }
            onClick={() =>
              void perform(async () => {
                const saved = await save();
                await api(`admin/campaigns/${saved.id}/send`, {
                  version: saved.version,
                  confirmed: true,
                  testEmail,
                });
                notify("Prueba registrada en la cola de envío.");
                await refresh();
              })
            }
          >
            Enviar prueba
          </button>
          <hr />
          <h3>Suscriptores autorizados</h3>
          {contacts.length ? (
            contacts.map((contact) => (
              <label key={contact.id} className="recipient-row">
                <input
                  type="checkbox"
                  checked={recipients.includes(contact.id)}
                  onChange={(e) =>
                    setRecipients((ids) =>
                      e.target.checked
                        ? [...ids, contact.id]
                        : ids.filter((id) => id !== contact.id),
                    )
                  }
                />
                <span>
                  {contact.first_name}
                  <small>{contact.email}</small>
                </span>
              </label>
            ))
          ) : (
            <p className="muted">
              Todavía no hay suscriptores con consentimiento vigente.
            </p>
          )}
          <button
            className="nd-button primary full"
            disabled={
              !!busy ||
              !recipients.length ||
              !workspace.connections.smtp?.configured
            }
            onClick={() =>
              void perform(async () => {
                if (
                  !window.confirm(
                    `¿Enviar esta newsletter a ${recipients.length} contacto(s) seleccionado(s)?`,
                  )
                )
                  return;
                const saved = await save();
                await api(`admin/campaigns/${saved.id}/send`, {
                  version: saved.version,
                  confirmed: true,
                  recipientIds: recipients,
                });
                notify("Envío registrado. Consulta el historial.");
                setModal(null);
                await refresh();
              })
            }
          >
            Confirmar envío a {recipients.length} contacto(s)
          </button>
        </Modal>
      )}
    </div>
  );
}
