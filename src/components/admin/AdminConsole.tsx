import { useCallback, useEffect, useState } from "react";
import {
  Inbox as InboxIcon,
  House,
  CircleHelp,
  PanelsTopLeft,
  MessagesSquare,
  Mail,
  Layers,
  CalendarDays,
  BookOpen,
  Users,
  Plug,
  ExternalLink,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  Check,
  ArrowRight,
} from "lucide-react";
import { api } from "./api";
import type { Workspace } from "./types";
import Inbox from "./Inbox";
import ChannelManager from "./ChannelManager";
import SiteStudio from "./SiteStudio";
import UserGuide from "./UserGuide";

import NewsletterStudio from "./NewsletterStudio";
import SocialStudio from "./SocialStudio";
import { Catalog, Connections, WebsiteContent, Contacts } from "./Management";
const navigation = [
  {
    id: "overview",
    label: "Inicio del admin",
    icon: House,
    group: "NEURO DIVERSA",
  },
  {
    id: "site",
    label: "Editor visual del sitio",
    icon: PanelsTopLeft,
    group: "SITIO WEB",
  },
  { id: "inbox", label: "Inbox pacientes", icon: InboxIcon, group: "ATENCIÓN" },
  { id: "channel", label: "Olivia · Channel manager", icon: MessagesSquare },
  {
    id: "mailing",
    label: "Mailing & newsletters",
    icon: Mail,
    group: "COMUNICACIÓN",
  },
  { id: "social", label: "Buffer Studio", icon: Layers },
  { id: "catalog", label: "Actividades y recursos", icon: CalendarDays },
  { id: "contacts", label: "Suscriptores", icon: Users },
  {
    id: "articles",
    label: "Artículos del sitio",
    icon: BookOpen,
    group: "SITIO WEB",
  },
  { id: "program", label: "Programa grupal", icon: CalendarDays },
  {
    id: "connections",
    label: "Conexiones y accesos",
    icon: Plug,
    group: "ADMINISTRACIÓN",
  },
  { id: "guide", label: "Guía de uso", icon: CircleHelp, group: "AYUDA" },
];
export default function AdminConsole() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [panel, setPanel] = useState(() =>
      navigation.some((n) => n.id === window.location.hash.slice(1))
        ? window.location.hash.slice(1)
        : window.location.pathname.startsWith("/inbox")
          ? "channel"
          : "overview",
    ),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false),
    [loginError, setLoginError] = useState(""),
    [busy, setBusy] = useState(false),
    [activated, setActivated] = useState(false),
    [oliviaAvailable, setOliviaAvailable] = useState<boolean | null>(null);
  const invite = new URLSearchParams(window.location.search).get("invite");
  const notify = useCallback((message: string) => setNotice(message), []);
  const refresh = useCallback(async () => {
    const data = await api<Workspace>("admin/workspace");
    setWorkspace(data);
    return data;
  }, []);
  useEffect(() => {
    void refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
    const expired = () => setWorkspace(null);
    window.addEventListener("neurodiversa:session-expired", expired);
    return () =>
      window.removeEventListener("neurodiversa:session-expired", expired);
  }, [refresh]);
  useEffect(() => {
    if (!workspace) return;
    let alive = true;
    const check = () =>
      api<{ available: boolean }>("widget/status")
        .then((d) => {
          if (alive) setOliviaAvailable(d.available);
        })
        .catch(() => {
          if (alive) setOliviaAvailable(false);
        });
    void check();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [!!workspace]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice]);
  const navigate = (id: string) => {
    if (
      !window.dispatchEvent(
        new Event("neurodiversa:before-navigation", { cancelable: true }),
      )
    )
      return;
    setPanel(id);
    history.replaceState(null, "", `#${id}`);
    setMobile(false);
    setNotice("");
  };
  const login = async (form: HTMLFormElement) => {
    setBusy(true);
    setLoginError("");
    try {
      const data = Object.fromEntries(new FormData(form));
      if (invite && !activated) {
        await api("invitations/accept", { ...data, token: invite });
        setActivated(true);
        history.replaceState(null, "", "/admin/");
        setLoginError(
          "Acceso activado. Inicia sesión con tu email y contraseña.",
        );
      } else {
        await api("auth/sign-in/email", data);
        await refresh();
      }
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="admin-loading">
        <img src="/neuro-diversa-logo.webp" alt="Neuro Diversa" />
        <span className="loading-spinner" />
        <p>Abriendo tu espacio…</p>
      </div>
    );
  if (!workspace)
    return (
      <div className="login-page">
        <a className="login-back" href="/">
          ← Volver a neurodiversa.mx
        </a>
        <section className="login-card">
          <div className="login-intro">
            <img
              src="/neuro-diversa-logo-light.webp"
              alt="Neuro Diversa"
              width="210"
              height="98"
            />
            <div>
              <span className="eyebrow">ESPACIO PRIVADO</span>
              <h1>
                El cuidado también
                <br />
                empieza aquí.
              </h1>
              <p>
                Tu equipo, las conversaciones y la comunicación de Neuro
                Diversa.
              </p>
            </div>
            <div className="login-features">
              <span>
                <MessagesSquare size={17} /> Inbox de pacientes y Olivia AI
              </span>
              <span>
                <Mail size={17} /> Estudio editorial y newsletters
              </span>
              <span>
                <Layers size={17} /> Redes sociales con Buffer
              </span>
            </div>
            <small>NEURO DIVERSA · SAN ÁNGEL, CDMX</small>
          </div>
          <div className="login-form-panel">
            <span className="private-tag">
              <ShieldCheck size={14} />
              Acceso del equipo
            </span>
            <h2>{invite && !activated ? "Activa tu acceso" : "Bienvenido"}</h2>
            <p>
              {invite && !activated
                ? "Elige el nombre y la contraseña de tu cuenta."
                : "Inicia sesión para abrir tu espacio de trabajo."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void login(e.currentTarget);
              }}
            >
              {invite && !activated ? (
                <label className="nd-field">
                  Tu nombre
                  <input
                    required
                    name="name"
                    autoComplete="name"
                    minLength={2}
                  />
                </label>
              ) : (
                <label className="nd-field">
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="username"
                    placeholder="tu@email.com"
                  />
                </label>
              )}
              <label className="nd-field">
                Contraseña
                <input
                  type="password"
                  name="password"
                  minLength={12}
                  maxLength={128}
                  required
                  autoComplete={
                    invite && !activated ? "new-password" : "current-password"
                  }
                  placeholder="Tu contraseña"
                />
              </label>
              {loginError && (
                <p className="login-error" role="alert">
                  {loginError}
                </p>
              )}
              <button className="nd-button primary full" disabled={busy}>
                {busy
                  ? "Abriendo…"
                  : invite && !activated
                    ? "Activar acceso"
                    : "Entrar al workspace"}
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="login-footnote">
              Solo las personas autorizadas por el equipo pueden acceder.
            </p>
          </div>
        </section>
        <footer>Neuro Diversa · Un espacio para comprenderte.</footer>
      </div>
    );
  const props = { workspace, refresh, notify },
    current = navigation.find((n) => n.id === panel)!;
  return (
    <div
      className={`workspace-shell ${mobile ? "nav-open" : ""} ${panel === "channel" ? "channel-fullscreen" : ""}`}
    >
      <aside className="workspace-sidebar">
        <a className="workspace-brand" href="/">
          <img
            src="/neuro-diversa-logo-light.webp"
            alt="Neuro Diversa"
            width="152"
            height="71"
          />
          <span>WORKSPACE</span>
        </a>
        <button
          className="mobile-nav-close icon-button"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <nav aria-label="Administración">
          {navigation.map(({ id, label, icon: Icon, group }) => (
            <div key={id}>
              {group && <p className="nav-group">{group}</p>}
              <button
                aria-current={panel === id ? "page" : undefined}
                className={panel === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={17} />
                <span>{label}</span>
                {panel === id && <ChevronRight size={13} />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="olivia-status">
            <span
              className={`live-dot ${oliviaAvailable === true ? "online" : oliviaAvailable === false ? "sleep" : ""}`}
            />
            <div>
              <strong>Olivia AI</strong>
              <small>
                {oliviaAvailable === true
                  ? "3.6 · Disponible"
                  : oliviaAvailable === false
                    ? "Temporalmente en pausa"
                    : "Comprobando estado…"}
              </small>
            </div>
            <span>WEB</span>
          </div>
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            Abrir sitio web
          </a>
          <button
            onClick={async () => {
              try {
                await api("auth/sign-out", {});
                setWorkspace(null);
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-nav-shade"
          aria-label="Cerrar menú"
          onClick={() => setMobile(false)}
        />
      )}
      <main className={`workspace-main module-${panel}`}>
        <header className="workspace-topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Neuro Diversa</span>
            <ChevronRight size={13} />
            <strong>{current.label}</strong>
          </div>
          <div>
            <button
              type="button"
              className="admin-help-link"
              aria-label="Abrir guía de uso"
              onClick={() => navigate("guide")}
            >
              <CircleHelp size={15} />
              <span>Guía de uso</span>
            </button>
            <span className="private-indicator">
              <ShieldCheck size={13} />
              Espacio privado
            </span>
            <span className="user-avatar">
              {workspace.user.name?.slice(0, 1) || "O"}
            </span>
            <span className="user-info">
              <strong>{workspace.user.name}</strong>
              <small>
                {workspace.user.role === "owner" ? "Administración" : "Equipo"}
              </small>
            </span>
          </div>
        </header>
        <div className="workspace-content">
          {panel === "overview" && (
            <div className="admin-home">
              <span className="eyebrow">NEURO DIVERSA · ADMINISTRACIÓN</span>
              <h1>Tu sitio y tu equipo, en un mismo lugar.</h1>
              <p>
                Abre una herramienta para editar, dar seguimiento o preparar tu
                comunicación.
              </p>
              <div className="admin-module-grid">
                {[
                  {
                    id: "site",
                    title: "Editar el sitio",
                    text: "Textos, fotografías, enlaces y SEO sobre el diseño real. Directus.",
                    icon: PanelsTopLeft,
                  },
                  {
                    id: "channel",
                    title: "Olivia · Channel manager",
                    text: "Conversaciones, atención del equipo, notas y seguimiento.",
                    icon: MessagesSquare,
                  },
                  {
                    id: "inbox",
                    title: "Pacientes interesados",
                    text: "Solicitudes del grupo y de atención individual.",
                    icon: InboxIcon,
                  },
                  {
                    id: "mailing",
                    title: "Mailing & newsletters",
                    text: "Campañas, documentos, diseño y borradores Mailchimp.",
                    icon: Mail,
                  },
                  {
                    id: "social",
                    title: "Buffer Studio",
                    text: "Publicaciones, imágenes, canales y programación.",
                    icon: Layers,
                  },
                  {
                    id: "articles",
                    title: "Artículos y lecturas",
                    text: "Borradores y publicaciones del equipo en Directus.",
                    icon: BookOpen,
                  },
                  {
                    id: "program",
                    title: "Programa grupal",
                    text: "Información y condiciones del proyecto de habilidades sociales.",
                    icon: CalendarDays,
                  },
                  {
                    id: "catalog",
                    title: "Actividades y recursos",
                    text: "Biblioteca editorial para newsletters, agenda y redes.",
                    icon: CalendarDays,
                  },
                  {
                    id: "connections",
                    title: "Conexiones y accesos",
                    text: "Cuentas del equipo y conexiones de comunicación.",
                    icon: Plug,
                  },
                  {
                    id: "guide",
                    title: "Guía de uso",
                    text: "Cómo editar, publicar, atender solicitudes y preparar campañas, paso a paso.",
                    icon: CircleHelp,
                  },
                ].map(({ id, title, text, icon: Icon }) => (
                  <button key={id} onClick={() => navigate(id)}>
                    <Icon size={25} />
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {panel === "guide" && <UserGuide onOpen={navigate} />}
          {panel === "site" && <SiteStudio notify={notify} />}
          {panel === "inbox" && <Inbox notify={notify} />}
          {panel === "channel" && (
            <ChannelManager
              user={workspace.user}
              notify={notify}
              onBack={() => navigate("mailing")}
              onConnections={() => navigate("connections")}
            />
          )}{" "}
          {panel === "mailing" && (
            <NewsletterStudio {...props} onSocial={() => navigate("social")} />
          )}{" "}
          {panel === "social" && (
            <SocialStudio
              {...props}
              onConnections={() => navigate("connections")}
            />
          )}{" "}
          {panel === "catalog" && <Catalog {...props} />}{" "}
          {panel === "contacts" && <Contacts {...props} />}{" "}
          {panel === "articles" && <WebsiteContent {...props} />}{" "}
          {panel === "program" && <WebsiteContent {...props} program />}{" "}
          {panel === "connections" && <Connections {...props} />}
        </div>
      </main>
      {notice && (
        <div className="workspace-toast" role="status">
          <span>{notice}</span>
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
