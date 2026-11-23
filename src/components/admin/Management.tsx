import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Save,
  ExternalLink,
  Mail,
  CalendarDays,
  ShieldCheck,
  Plug,
  Users,
  FileText,
} from "lucide-react";
import { api, formatDate } from "./api";
import { Badge, Empty, ImagePicker, Modal } from "./ui";
import type { Workspace, NewsletterEvent } from "./types";
type Props = {
  workspace: Workspace;
  refresh: () => Promise<Workspace>;
  notify: (text: string) => void;
};
const field = (data: Record<string, unknown>, key: string) =>
  String(data[key] || "");
export function Connections({ workspace, refresh, notify }: Props) {
  const [busy, setBusy] = useState(false),
    [invite, setInvite] = useState("");
  const submit = async (form: HTMLFormElement, provider: string) => {
    setBusy(true);
    try {
      const data = Object.fromEntries(new FormData(form));
      if (provider === "smtp")
        data.port = Number(data.port) as unknown as string;
      await api("admin/connections", { [provider]: data }, "PATCH");
      form
        .querySelectorAll<HTMLInputElement>("input[type=password]")
        .forEach((input) => (input.value = ""));
      await refresh();
      notify("Conexión guardada.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const owner = workspace.user.role === "owner",
    smtp = workspace.connections.smtp || {},
    buffer = workspace.connections.buffer || {},
    mc = workspace.connections.mailchimp || {};
  return (
    <div className="management-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Conexiones y accesos</h1>
          <p>Conecta las cuentas de Neuro Diversa cuando estés listo.</p>
        </div>
        <span className="private-tag">
          <ShieldCheck size={15} />
          Credenciales cifradas
        </span>
      </div>
      {!owner ? (
        <Empty icon={ShieldCheck} title="Acceso de administración">
          Tu cuenta puede gestionar contenidos y solicitudes. La administración
          configura las conexiones.
        </Empty>
      ) : (
        <>
          <div className="connection-grid">
            <form
              className="management-card"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, "buffer");
              }}
            >
              <div className="card-title">
                <span className="connection-logo">B</span>
                <div>
                  <h2>Buffer</h2>
                  <p>Redes sociales y programación</p>
                </div>
                <Badge value={buffer.configured ? "Conectado" : "Pendiente"} />
              </div>
              <label className="nd-field">
                Clave API
                <input
                  name="apiKey"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    buffer.configured
                      ? "Dejar vacío para conservar"
                      : "Clave personal de Buffer"
                  }
                />
              </label>
              <label className="nd-field">
                ID de organización
                <input
                  name="organizationId"
                  defaultValue={field(buffer, "organizationId")}
                />
              </label>
              <a
                className="inline-link"
                href="https://publish.buffer.com/settings/api"
                target="_blank"
                rel="noreferrer"
              >
                Abrir configuración Buffer <ExternalLink size={13} />
              </a>
              <button className="nd-button primary" disabled={busy}>
                <Save size={14} />
                Guardar Buffer
              </button>
            </form>
            <form
              className="management-card"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, "mailchimp");
              }}
            >
              <div className="card-title">
                <span className="connection-logo mc">M</span>
                <div>
                  <h2>Mailchimp</h2>
                  <p>Audiencias y borradores de newsletter</p>
                </div>
                <Badge value={mc.configured ? "Conectado" : "Pendiente"} />
              </div>
              <label className="nd-field">
                Nombre de cuenta
                <input
                  name="accountLabel"
                  defaultValue={field(mc, "accountLabel") || "Neuro Diversa"}
                />
              </label>
              <label className="nd-field">
                Clave API
                <input
                  type="password"
                  name="apiKey"
                  autoComplete="new-password"
                  placeholder="Dejar vacío para conservar"
                />
              </label>
              <div className="two-fields">
                <label className="nd-field">
                  Servidor
                  <input
                    name="serverPrefix"
                    placeholder="us21"
                    defaultValue={field(mc, "serverPrefix")}
                    required
                    pattern="us[0-9]+"
                  />
                </label>
                <label className="nd-field">
                  ID de audiencia
                  <input
                    name="audienceId"
                    required
                    defaultValue={field(mc, "audienceId")}
                  />
                </label>
              </div>
              <label className="nd-field">
                Nombre del remitente
                <input
                  name="fromName"
                  required
                  defaultValue={field(mc, "fromName") || "Neuro Diversa"}
                />
              </label>
              <label className="nd-field">
                Email del remitente
                <input
                  name="fromEmail"
                  type="email"
                  required
                  defaultValue={field(mc, "fromEmail")}
                />
              </label>
              <label className="nd-field">
                Responder a
                <input
                  name="replyTo"
                  type="email"
                  required
                  defaultValue={field(mc, "replyTo")}
                />
              </label>
              <div className="button-row">
                <button className="nd-button primary" disabled={busy}>
                  Guardar Mailchimp
                </button>
                <button
                  className="nd-button"
                  type="button"
                  disabled={!mc.configured || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("admin/mailchimp/test", {});
                      notify("Mailchimp conectado.");
                    } catch (e) {
                      notify((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Comprobar
                </button>
              </div>
            </form>
            <form
              className="management-card"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget, "smtp");
              }}
            >
              <div className="card-title">
                <span className="connection-logo smtp">
                  <Mail size={20} />
                </span>
                <div>
                  <h2>Remitente SMTP</h2>
                  <p>Pruebas y envío directo a suscriptores</p>
                </div>
                <Badge value={smtp.configured ? "Conectado" : "Pendiente"} />
              </div>
              <div className="two-fields">
                <label className="nd-field">
                  Servidor
                  <input
                    name="host"
                    required
                    defaultValue={field(smtp, "host")}
                  />
                </label>
                <label className="nd-field">
                  Puerto
                  <select
                    name="port"
                    defaultValue={field(smtp, "port") || "587"}
                  >
                    <option value="587">587 · STARTTLS</option>
                    <option value="465">465 · TLS</option>
                  </select>
                </label>
              </div>
              <label className="nd-field">
                Usuario
                <input
                  name="username"
                  required
                  defaultValue={field(smtp, "username")}
                  autoComplete="off"
                />
              </label>
              <label className="nd-field">
                Contraseña
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Dejar vacío para conservar"
                />
              </label>
              <label className="nd-field">
                Nombre del remitente
                <input
                  name="fromName"
                  required
                  defaultValue={field(smtp, "fromName") || "Neuro Diversa"}
                />
              </label>
              <label className="nd-field">
                Email del remitente
                <input
                  name="fromEmail"
                  type="email"
                  required
                  defaultValue={field(smtp, "fromEmail")}
                />
              </label>
              <button className="nd-button primary" disabled={busy}>
                Guardar remitente
              </button>
            </form>
          </div>
          <div className="team-access-card">
            <div>
              <Users size={24} />
              <h2>Accesos del equipo</h2>
              <p>
                Las invitaciones se preparan cuando decidas quién debe entrar.
              </p>
              <span className="account-chip">
                {workspace.user.email} · Administración
              </span>
            </div>
            <details>
              <summary>Crear una invitación privada</summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const result = await api<{ link: string }>(
                      "admin/invitations",
                      Object.fromEntries(new FormData(e.currentTarget)),
                    );
                    setInvite(result.link);
                  } catch (error) {
                    notify((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="nd-field">
                  Email
                  <input name="email" required type="email" />
                </label>
                <label className="nd-field">
                  Permisos
                  <select name="role">
                    <option value="editor">Contenidos, inbox y campañas</option>
                    <option value="owner">Administración</option>
                  </select>
                </label>
                <button className="nd-button" disabled={busy}>
                  Crear enlace
                </button>
                {invite && (
                  <label className="nd-field">
                    Enlace privado
                    <input
                      readOnly
                      value={invite}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
              </form>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
export function Catalog({ workspace, refresh, notify }: Props) {
  const [query, setQuery] = useState(""),
    [event, setEvent] = useState<NewsletterEvent | null>(null),
    [busy, setBusy] = useState(false);
  const patch = (data: Partial<NewsletterEvent>) =>
    setEvent((current) => (current ? { ...current, ...data } : null));
  return (
    <div className="management-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">BIBLIOTECA EDITORIAL</span>
          <h1>Actividades y recursos</h1>
          <p>Un catálogo reutilizable para newsletters, agenda y redes.</p>
        </div>
        <button
          className="nd-button primary"
          onClick={() =>
            setEvent({
              id: crypto.randomUUID(),
              category: "Actividad",
              title: "",
              date: "Por confirmar",
              venue: "San Ángel, CDMX",
              description: "",
              url: "https://neurodiversa.mx",
              sourceLabel: "Neuro Diversa",
              imageUrl: "",
              sortDate: "",
              language: "es",
            })
          }
        >
          <Plus size={15} />
          Añadir actividad
        </button>
      </div>
      <div className="catalog-search-row">
        <Search size={16} />
        <input
          aria-label="Buscar actividades"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, categoría o lugar…"
        />
        <span>{workspace.catalog.length} elementos</span>
      </div>
      {workspace.catalog.length ? (
        <div className="catalog-grid">
          {workspace.catalog
            .filter((e) =>
              `${e.title} ${e.venue} ${e.category}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((e) => (
              <article key={e.id}>
                {e.imageUrl ? (
                  <img src={e.imageUrl} alt="" />
                ) : (
                  <div className="catalog-placeholder">
                    <CalendarDays size={30} />
                  </div>
                )}
                <div>
                  <span className="eyebrow">
                    {e.category} · {e.language === "en" ? "EN" : "ES"}
                  </span>
                  <h2>{e.title}</h2>
                  <p>
                    {e.date} · {e.venue}
                  </p>
                  <p>{e.description.slice(0, 160)}</p>
                  <button className="nd-button" onClick={() => setEvent(e)}>
                    Editar actividad
                  </button>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <Empty icon={CalendarDays} title="Tu catálogo comienza aquí">
          Añade las actividades y lecturas que quieras compartir. También puedes
          guardarlas desde una newsletter.
        </Empty>
      )}
      {event && (
        <Modal
          title={event.version ? "Editar actividad" : "Nueva actividad"}
          onClose={() => setEvent(null)}
          wide
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("admin/catalog", event);
                await refresh();
                setEvent(null);
                notify("Actividad guardada.");
              } catch (error) {
                notify((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="two-fields">
              <div>
                <label className="nd-field">
                  Título
                  <input
                    required
                    value={event.title}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </label>
                <div className="two-fields">
                  <label className="nd-field">
                    Categoría
                    <input
                      value={event.category}
                      onChange={(e) => patch({ category: e.target.value })}
                    />
                  </label>
                  <label className="nd-field">
                    Idioma
                    <select
                      value={event.language || "es"}
                      onChange={(e) =>
                        patch({ language: e.target.value as "es" | "en" })
                      }
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </div>
                <div className="two-fields">
                  <label className="nd-field">
                    Fecha de calendario
                    <input
                      type="date"
                      value={event.sortDate || ""}
                      onChange={(e) => patch({ sortDate: e.target.value })}
                    />
                  </label>
                  <label className="nd-field">
                    Fecha visible
                    <input
                      value={event.date}
                      onChange={(e) => patch({ date: e.target.value })}
                    />
                  </label>
                </div>
                <label className="nd-field">
                  Lugar
                  <input
                    value={event.venue}
                    onChange={(e) => patch({ venue: e.target.value })}
                  />
                </label>
                <label className="nd-field">
                  Descripción
                  <textarea
                    rows={6}
                    value={event.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </label>
              </div>
              <div>
                <ImagePicker
                  value={event.imageUrl || ""}
                  onChange={(imageUrl) => patch({ imageUrl })}
                  workspace={workspace}
                  refresh={refresh}
                />
                <label className="nd-field">
                  URL de la imagen
                  <input
                    value={event.imageUrl || ""}
                    onChange={(e) => patch({ imageUrl: e.target.value })}
                  />
                </label>
                <label className="nd-field">
                  Enlace oficial
                  <input
                    type="url"
                    value={event.url}
                    onChange={(e) => patch({ url: e.target.value })}
                  />
                </label>
                <label className="nd-field">
                  Nombre de la fuente
                  <input
                    value={event.sourceLabel}
                    onChange={(e) => patch({ sourceLabel: e.target.value })}
                  />
                </label>
              </div>
            </div>
            <div className="button-row">
              <button className="nd-button primary" disabled={busy}>
                Guardar actividad
              </button>
              <button
                type="button"
                className="nd-button"
                onClick={() => setEvent(null)}
              >
                Cancelar
              </button>
              {event.version && (
                <button
                  type="button"
                  className="nd-button danger"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "¿Quitar esta actividad del catálogo? Las campañas existentes se conservan.",
                      )
                    )
                      return;
                    try {
                      await api(
                        `admin/catalog/${event.id}`,
                        undefined,
                        "DELETE",
                      );
                      await refresh();
                      setEvent(null);
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Quitar del catálogo
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function WebsiteContent({
  workspace,
  refresh,
  notify,
  program = false,
}: Props & { program?: boolean }) {
  const [post, setPost] = useState<Record<string, unknown>>({
      title: "",
      author: "Psic. Cindy Alvarado Mondragón",
      category: "Neurodiversidad",
      body: "",
      language: "es",
      status: "draft",
    }),
    [busy, setBusy] = useState(false);
  const save = async (data: unknown, path: string, method = "POST") => {
    setBusy(true);
    try {
      const result = await api<{ id?: string }>(path, data, method);
      const fresh = await refresh();
      if (path === "admin/posts") {
        const saved = fresh.posts.find((p) => p.id === result.id);
        if (saved) setPost(saved);
      }
      notify("Contenido guardado en el sitio.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const values = workspace.program || {
    title: "Habilidades sociales",
    start: "Enero 2027*",
    weeks: 16,
    minutes: 90,
  };
  return (
    <div className="management-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">SITIO WEB</span>
          <h1>{program ? "Programa grupal" : "Artículos y lecturas"}</h1>
          <p>
            {program
              ? "Actualiza la información del programa que aparece en el sitio."
              : "Prepara borradores y publica las lecturas del equipo."}
          </p>
        </div>
        <a
          className="nd-button"
          href={program ? "/programas/habilidades-sociales/" : "/blog/"}
          target="_blank"
          rel="noreferrer"
        >
          Ver en el sitio <ExternalLink size={14} />
        </a>
      </div>
      {program ? (
        <div className="program-layout">
          <form
            className="management-card"
            onSubmit={(e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              void save(
                {
                  ...data,
                  weeks: Number(data.weeks),
                  minutes: Number(data.minutes),
                },
                "admin/program",
                "PUT",
              );
            }}
          >
            <h2>Información del programa</h2>
            <label className="nd-field">
              Título
              <input
                name="title"
                required
                defaultValue={field(values, "title")}
              />
            </label>
            <label className="nd-field">
              Inicio propuesto
              <input
                name="start"
                required
                defaultValue={field(values, "start")}
              />
            </label>
            <div className="two-fields">
              <label className="nd-field">
                Semanas
                <input
                  name="weeks"
                  type="number"
                  min="1"
                  max="52"
                  required
                  defaultValue={field(values, "weeks")}
                />
              </label>
              <label className="nd-field">
                Minutos por sesión
                <input
                  name="minutes"
                  type="number"
                  min="15"
                  max="240"
                  required
                  defaultValue={field(values, "minutes")}
                />
              </label>
            </div>
            <button className="nd-button primary" disabled={busy}>
              Guardar en el sitio
            </button>
          </form>
          <aside className="program-note">
            <CalendarDays size={28} />
            <h2>Habilidades sociales en grupo</h2>
            <p>
              Las personas interesadas pueden dejar su solicitud desde la página
              del programa o el chat de Olivia.
            </p>
            <p>Encontrarás sus datos y el seguimiento en Inbox pacientes.</p>
          </aside>
        </div>
      ) : (
        <div className="content-layout">
          <form
            className="management-card"
            onSubmit={(e) => {
              e.preventDefault();
              void save(post, "admin/posts");
            }}
          >
            <div className="card-title">
              <FileText size={20} />
              <h2>{post.id ? "Editar artículo" : "Nuevo artículo"}</h2>
            </div>
            <label className="nd-field">
              Título
              <input
                required
                value={field(post, "title")}
                onChange={(e) =>
                  setPost((p) => ({ ...p, title: e.target.value }))
                }
              />
            </label>
            <div className="two-fields">
              <label className="nd-field">
                Autora
                <select
                  value={field(post, "author")}
                  onChange={(e) =>
                    setPost((p) => ({ ...p, author: e.target.value }))
                  }
                >
                  <option>Psic. Cindy Alvarado Mondragón</option>
                  <option>Dra. Ariadna Mondragón</option>
                </select>
              </label>
              <label className="nd-field">
                Idioma
                <select
                  value={field(post, "language")}
                  onChange={(e) =>
                    setPost((p) => ({ ...p, language: e.target.value }))
                  }
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <label className="nd-field">
              Categoría
              <input
                value={field(post, "category")}
                required
                onChange={(e) =>
                  setPost((p) => ({ ...p, category: e.target.value }))
                }
              />
            </label>
            <label className="nd-field">
              Contenido
              <textarea
                rows={15}
                value={field(post, "body")}
                required
                maxLength={30000}
                onChange={(e) =>
                  setPost((p) => ({ ...p, body: e.target.value }))
                }
              />
            </label>
            <label className="nd-field">
              Estado
              <select
                aria-label="Estado del artículo"
                value={field(post, "status")}
                onChange={(e) =>
                  setPost((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option value="draft">Borrador privado</option>
                <option value="published">Publicado en el blog</option>
              </select>
            </label>
            <button className="nd-button primary" disabled={busy}>
              Guardar artículo
            </button>
          </form>
          <section className="articles-library">
            <h2>Biblioteca del sitio</h2>
            {workspace.posts.length ? (
              workspace.posts.map((p) => (
                <button key={field(p, "id")} onClick={() => setPost(p)}>
                  <Badge value={field(p, "status")} />
                  <h3>{field(p, "title")}</h3>
                  <p>{field(p, "body").slice(0, 130)}</p>
                  <small>{field(p, "author")}</small>
                </button>
              ))
            ) : (
              <Empty icon={FileText} title="Prepara tu primera lectura">
                Los borradores se conservan en privado hasta que decidas
                publicarlos.
              </Empty>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
export function Contacts({ notify }: Props) {
  const [contacts, setContacts] = useState<Array<Record<string, unknown>>>([]),
    [loaded, setLoaded] = useState(false),
    [modal, setModal] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void api<{ contacts: Array<Record<string, unknown>> }>("admin/contacts")
      .then((d) => {
        if (alive) setContacts(d.contacts);
      })
      .catch((e) => notify(e.message))
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="management-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">MAILING · AUDIENCIA</span>
          <h1>Suscriptores</h1>
          <p>Contactos que autorizaron recibir el boletín.</p>
        </div>
        <button className="nd-button primary" onClick={() => setModal(true)}>
          <Plus size={15} />
          Añadir contacto
        </button>
      </div>
      {contacts.length ? (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Origen del consentimiento</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={field(c, "id")}>
                  <td>
                    {field(c, "first_name")} {field(c, "last_name")}
                  </td>
                  <td>{field(c, "email")}</td>
                  <td>
                    <Badge
                      value={
                        c.opted_out
                          ? "Baja"
                          : c.opted_in
                            ? "Suscrito"
                            : "Sin autorización"
                      }
                    />
                  </td>
                  <td>{field(c, "consent_source")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={Users} title="Tu audiencia aparecerá aquí">
          Las solicitudes de pacientes y las suscripciones se gestionan por
          separado. Solo se añaden suscriptores con autorización.
        </Empty>
      )}
      {modal && (
        <Modal
          title="Añadir contacto autorizado"
          onClose={() => setModal(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const data = Object.fromEntries(new FormData(e.currentTarget));
                await api("admin/contacts", { ...data, consent: true });
                const result = await api<{
                  contacts: Array<Record<string, unknown>>;
                }>("admin/contacts");
                setContacts(result.contacts);
                setModal(false);
                notify("Contacto guardado.");
              } catch (error) {
                notify((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {[
              ["firstName", "Nombre"],
              ["lastName", "Apellido"],
              ["email", "Email"],
              ["consentSource", "Origen y fecha de autorización"],
            ].map(([name, label]) => (
              <label className="nd-field" key={name}>
                {label}
                <input
                  name={name}
                  type={name === "email" ? "email" : "text"}
                  required={name !== "lastName"}
                  minLength={name === "consentSource" ? 5 : 1}
                />
              </label>
            ))}
            <label className="recipient-row">
              <input type="checkbox" required />
              El contacto autorizó recibir newsletters.
            </label>
            <button className="nd-button primary" disabled={busy}>
              Guardar contacto
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
