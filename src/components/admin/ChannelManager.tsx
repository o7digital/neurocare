// Console UI ported from o7digital/suitesmine-bot/app/inbox/page.js.
// Uses only Neuro Diversa's authenticated tenant, conversations and Olivia 3.6.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AtSign,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  UsersRound,
  Wand2,
  Zap,
  X,
  RefreshCw,
  ArrowLeft,
  PanelRight,
  PanelLeft,
  Download,
  Plus,
  Copy,
  Globe,
  Clock,
  FileText,
} from "lucide-react";
import { api } from "./api";
import { channelCopy, type ChannelLanguage } from "./channelCopy";
import { Modal } from "./ui";
import type { Workspace } from "./types";
import type {
  ChannelDetail,
  ChannelFile,
  ChannelMessage,
  ChannelSettings,
  ChannelSummary,
  ChannelThread,
} from "./channelTypes";
type Props = {
  user: Workspace["user"];
  notify: (text: string) => void;
  onBack: () => void;
  onConnections: () => void;
};
const skin = { accent: "#53cdbb", soft: "#e8fbf8", operator: "#3159c9" };
const emptySummary: ChannelSummary = {
  conversations: [],
  counts: {},
  total: 0,
  nextOffset: null,
  syncedAt: "",
};
const langLocale = { fr: "fr-FR", en: "en-US", es: "es-MX" };
function date(value: string, language: ChannelLanguage, full = false) {
  return value
    ? new Intl.DateTimeFormat(langLocale[language], {
        timeZone: "America/Mexico_City",
        ...(full
          ? { dateStyle: "long" }
          : { hour: "2-digit", minute: "2-digit" }),
      }).format(new Date(value))
    : "";
}
function StatusPill({
  mode,
  language,
}: {
  mode: string;
  language: ChannelLanguage;
}) {
  const copy = channelCopy[language];
  return (
    <span className={`oc-status ${mode}`}>
      {mode === "closed"
        ? copy.statuses.solved
        : mode === "manual"
          ? copy.statuses.manual
          : copy.statuses.ai}
    </span>
  );
}
function MessageBlock({
  message,
  thread,
  language,
}: {
  message: ChannelMessage;
  thread: ChannelThread;
  language: ChannelLanguage;
}) {
  const copy = channelCopy[language],
    guest = message.role === "visitor",
    ai = message.role === "assistant";
  return (
    <article
      className={`oc-message ${guest ? "guest" : ai ? "ai" : "operator"}`}
    >
      {guest && (
        <span className="oc-guest-avatar">
          {thread.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div>
        <header>
          <strong>{guest ? thread.name : ai ? "Olivia AI" : copy.you}</strong>
          <time>{date(message.created, language)}</time>
        </header>
        {message.content && (
          <div className="oc-message-content">{message.content}</div>
        )}
        {message.attachment && (
          <a
            className="oc-message-attachment"
            href={message.attachment.url}
            download={message.attachment.name}
          >
            <Paperclip size={15} />
            <span>
              {message.attachment.name}
              <small>{Math.ceil(message.attachment.size / 1024)} KB</small>
            </span>
            <Download size={14} />
          </a>
        )}
      </div>
    </article>
  );
}
export default function ChannelManager({
  user,
  notify,
  onBack,
  onConnections,
}: Props) {
  const [language, setLanguage] = useState<ChannelLanguage>(() => {
      try {
        const saved = localStorage.getItem("oliviaInboxLanguage");
        return saved === "en" || saved === "fr" || saved === "es"
          ? saved
          : "es";
      } catch {
        return "es";
      }
    }),
    [summary, setSummary] = useState<ChannelSummary>(emptySummary),
    [detail, setDetail] = useState<ChannelDetail | null>(null),
    [selected, setSelected] = useState(
      () => new URLSearchParams(location.search).get("conversation") || "",
    ),
    [view, setView] = useState("open"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [section, setSection] = useState("inbox"),
    [infoTab, setInfoTab] = useState("info"),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [toolBusy, setToolBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(""),
    [settings, setSettings] = useState<ChannelSettings | null>(null),
    [note, setNote] = useState(""),
    [tag, setTag] = useState(""),
    [tagOpen, setTagOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [infoOpen, setInfoOpen] = useState(false),
    [modal, setModal] = useState<"profile" | "quick" | "connect" | null>(null),
    [analysis, setAnalysis] = useState(""),
    [automation, setAutomation] = useState<
      ChannelSettings["automation"] | null
    >(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const draft = drafts[selected] || "",
    thread = detail?.conversation.id === selected ? detail.conversation : null;
  const pendingReply = useRef<{
    key: string;
    requestId: string;
    attachment?: ChannelFile;
  } | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    timelineRef = useRef<HTMLDivElement>(null),
    listEpoch = useRef(0),
    lastRead = useRef(""),
    previousMessages = useRef("");
  const copy = channelCopy[language];
  const setDraft = (text: string) =>
    setDrafts((d) => ({ ...d, [selected]: text }));
  useEffect(() => {
    const previous = document.title;
    document.title = "Olivia AI · Channel Manager | Neuro Diversa";
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const loadList = useCallback(async () => {
    const epoch = ++listEpoch.current;
    try {
      const result = await api<ChannelSummary>(
        `admin/channel/conversations?${new URLSearchParams({ view, q: search, offset: String(offset) })}`,
      );
      if (epoch !== listEpoch.current) return;
      setSummary(result);
      setLoaded(true);
      setLoadError("");
      if (
        !selectedRef.current &&
        result.conversations.length &&
        window.innerWidth > 760
      )
        setSelected(result.conversations[0].id);
    } catch (e) {
      if (epoch === listEpoch.current) {
        setLoaded(true);
        setLoadError((e as Error).message);
      }
    }
  }, [view, search, offset]);
  const loadDetail = useCallback(async (id: string) => {
    const result = await api<ChannelDetail>(
      `admin/channel/conversations/${id}`,
    );
    if (selectedRef.current === id) setDetail(result);
    return result;
  }, []);
  useEffect(() => {
    void loadList();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadList();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadList]);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setFile(null);
    setNote("");
    setTagOpen(false);
    setMenu(false);
    setAnalysis("");
    const params = new URL(location.href);
    params.searchParams.set("conversation", selected);
    history.replaceState(
      null,
      "",
      params.pathname + params.search + params.hash,
    );
    void loadDetail(selected).catch((e) => setLoadError(e.message));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void loadDetail(selected).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [selected, loadDetail]);
  useEffect(() => {
    void api<ChannelSettings>("admin/channel/settings")
      .then((s) => {
        setSettings(s);
        setAutomation(s.automation);
      })
      .catch((e) => notify(e.message));
  }, []);
  useEffect(() => {
    const data = detail;
    if (!data || !selected || document.visibilityState !== "visible") return;
    const last = data.messages.at(-1)?.sequence || 0,
      key = `${selected}:${last}`;
    if (lastRead.current === key) return;
    lastRead.current = key;
    void api(`admin/channel/conversations/${selected}/read`, {})
      .then(() => loadList())
      .catch(() => {});
  }, [selected, detail?.messages.at(-1)?.sequence]);
  useEffect(() => {
    if (!detail) return;
    const key = `${selected}:${detail.messages.at(-1)?.id || ""}`;
    if (previousMessages.current === key) return;
    const timeline = timelineRef.current;
    if (
      timeline &&
      (previousMessages.current.split(":")[0] !== selected ||
        timeline.scrollHeight - timeline.clientHeight - timeline.scrollTop <
          180)
    )
      timeline.scrollTop = timeline.scrollHeight;
    previousMessages.current = key;
  }, [selected, detail?.messages]);
  useEffect(() => {
    const check = (event: BeforeUnloadEvent) => {
      if (Object.values(drafts).some(Boolean) || note.trim() || file) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", check);
    return () => window.removeEventListener("beforeunload", check);
  }, [drafts, note, file]);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify((e as Error).message);
      if (selectedRef.current)
        void loadDetail(selectedRef.current).catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  const refresh = async (id = selected) => {
    await Promise.all([loadList(), ...(id ? [loadDetail(id)] : [])]);
  };
  const chooseView = (next: string) => {
    setView(next);
    setOffset(0);
    setSelected("");
    setSidebarOpen(false);
  };
  const status = async (mode: ChannelThread["mode"]) => {
    if (!thread) return;
    const id = thread.id;
    await api(
      `admin/channel/conversations/${id}/status`,
      { mode, version: thread.version },
      "PATCH",
    );
    if (mode === "closed") {
      setView("solved");
      setOffset(0);
    } else if (thread.mode === "closed") {
      setView("open");
      setOffset(0);
    }
    await refresh(id);
  };
  const send = async () => {
    if (!thread) return;
    const id = thread.id,
      content = draft,
      key = JSON.stringify([
        id,
        content,
        file?.name,
        file?.size,
        file?.lastModified,
      ]);
    if (pendingReply.current?.key !== key)
      pendingReply.current = { key, requestId: crypto.randomUUID() };
    const pending = pendingReply.current;
    if (file && !pending.attachment) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      pending.attachment = await api<ChannelFile>(
        `admin/channel/conversations/${id}/attachments`,
        { name: file.name, base64 },
      );
    }
    await api(`admin/channel/conversations/${id}/reply`, {
      content,
      requestId: pending.requestId,
      ...(pending.attachment ? { attachmentId: pending.attachment.id } : {}),
    });
    pendingReply.current = null;
    setDrafts((d) => ({ ...d, [id]: "" }));
    if (selectedRef.current === id) setFile(null);
    await refresh(id);
    const timeline = timelineRef.current;
    if (timeline) timeline.scrollTop = timeline.scrollHeight;
  };
  const assist = async (task: "reply" | "summary") => {
    if (!thread) return;
    const id = thread.id;
    setToolBusy(true);
    try {
      const result = await api<{ text: string }>(
        `admin/channel/conversations/${id}/suggestion`,
        { language, task },
      );
      if (selectedRef.current !== id) return;
      if (task === "reply") {
        setDrafts((d) => ({ ...d, [id]: result.text }));
        replyRef.current?.focus();
      } else setAnalysis(result.text);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setToolBusy(false);
    }
  };
  const saveTags = async (tags: string[]) => {
    if (!thread) return;
    await api(
      `admin/channel/conversations/${thread.id}/tags`,
      { tags, version: thread.version },
      "PATCH",
    );
    setTag("");
    setTagOpen(false);
    await refresh(thread.id);
  };
  const exportTranscript = () => {
    if (!thread || !detail) return;
    const text = [
        thread.name,
        thread.email,
        thread.phone,
        "",
        ...detail.messages.map(
          (m) =>
            `${date(m.created, language, true)} ${date(m.created, language)} · ${m.role}\n${m.content}${m.attachment ? "\n" + m.attachment.name : ""}`,
        ),
      ].join("\n\n"),
      url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `neurodiversa-${thread.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setMenu(false);
  };
  const me = thread?.assignee_id === user.id,
    manual = thread?.mode === "manual";
  const extra =
    language === "fr"
      ? {
          web: "Site web",
          workspace: "Retour au backend",
          edit: "Modifier le contact",
          save: "Enregistrer",
          privateNote: "Note interne",
          addNote: "Ajouter une note",
          notePlaceholder:
            "Une note pour l’équipe, jamais envoyée au visiteur.",
          tags: "Étiquettes",
          none: "Aucune",
          mine: "Mes conversations",
          refresh: "Actualiser",
          pages: "Les pages apparaissent après le consentement au chat.",
          profile: "Fiche patient",
          assigned: "Assigné à",
          unread: "Marquer non lu",
          export: "Exporter la conversation",
          link: "Copier le lien",
          reopen: "Rouvrir",
          liveAi: "Olivia répond automatiquement.",
          solved: "Conversation résolue.",
          more: "Plus d’actions",
          newNote: "Note ajoutée.",
          connect: "Comptes à connecter",
          connectText:
            "Le chat du site est actif. WhatsApp, Messenger, Instagram et la boîte mail attendent leurs propres connexions pour Neuro Diversa.",
          active: "Actif",
          back: "Retour",
          consent: "Consentement au contact",
          service: "Motif de contact",
          source: "Origine",
          title: "Titre de page",
          read: "Lu",
          replyOnly: "Vous devez prendre la main avant de répondre.",
          automatic: "Réponses automatiques",
          handoff: "Transfert au besoin d’un humain",
          configured: "Connecté",
          cancel: "Annuler",
        }
      : language === "en"
        ? {
            web: "Website",
            workspace: "Back to workspace",
            edit: "Edit contact",
            save: "Save",
            privateNote: "Internal note",
            addNote: "Add note",
            notePlaceholder: "A note for the team, never sent to the visitor.",
            tags: "Tags",
            none: "None",
            mine: "My conversations",
            refresh: "Refresh",
            pages: "Viewed pages appear after chat consent.",
            profile: "Patient profile",
            assigned: "Assigned to",
            unread: "Mark unread",
            export: "Export conversation",
            link: "Copy link",
            reopen: "Reopen",
            liveAi: "Olivia replies automatically.",
            solved: "Conversation solved.",
            more: "More actions",
            newNote: "Note added.",
            connect: "Accounts to connect",
            connectText:
              "Website chat is active. WhatsApp, Messenger, Instagram and the mailbox await their own connections for Neuro Diversa.",
            active: "Active",
            back: "Back",
            consent: "Contact consent",
            service: "Contact reason",
            source: "Source",
            title: "Page title",
            read: "Read",
            replyOnly: "Take over before replying.",
            automatic: "Automatic replies",
            handoff: "Handoff when a human is requested",
            configured: "Connected",
            cancel: "Cancel",
          }
        : {
            web: "Sitio web",
            workspace: "Volver al backend",
            edit: "Editar contacto",
            save: "Guardar",
            privateNote: "Nota interna",
            addNote: "Añadir nota",
            notePlaceholder:
              "Una nota para el equipo; nunca se envía al visitante.",
            tags: "Etiquetas",
            none: "Ninguna",
            mine: "Mis conversaciones",
            refresh: "Actualizar",
            pages: "Las páginas aparecen después del consentimiento al chat.",
            profile: "Ficha del paciente",
            assigned: "Asignada a",
            unread: "Marcar no leída",
            export: "Exportar conversación",
            link: "Copiar enlace",
            reopen: "Reabrir",
            liveAi: "Olivia responde automáticamente.",
            solved: "Conversación resuelta.",
            more: "Más acciones",
            newNote: "Nota añadida.",
            connect: "Cuentas por conectar",
            connectText:
              "El chat del sitio está activo. WhatsApp, Messenger, Instagram y el correo esperan sus propias conexiones para Neuro Diversa.",
            active: "Activo",
            back: "Volver",
            consent: "Autorización de contacto",
            service: "Motivo de contacto",
            source: "Origen",
            title: "Título de página",
            read: "Leída",
            replyOnly: "Toma el control antes de responder.",
            automatic: "Respuestas automáticas",
            handoff: "Transferir cuando se pide una persona",
            configured: "Conectado",
            cancel: "Cancelar",
          };
  const nav = [
    ["inbox", copy.nav[0], Inbox],
    ["automation", copy.nav[1], Bot],
    ["customers", copy.nav[2], UsersRound],
    ["analytics", copy.nav[3], LayoutDashboard],
    ["copilot", copy.nav[4], Sparkles],
  ] as const;
  const views = [
    ["unassigned", copy.views[0], "!"],
    ["open", copy.views[1], "[]"],
    ["solved", copy.views[2], "✓"],
  ];
  const canReply = !!thread && manual && me && !busy;
  return (
    <div
      className={`olivia-console ${selected ? "has-selection" : ""} ${sidebarOpen ? "sidebar-open" : ""} ${infoOpen ? "info-open" : ""} ${section !== "inbox" ? "oc-other-section" : ""}`}
      lang={language}
    >
      <aside className="oc-rail">
        <button
          className="oc-app-mark"
          title={extra.workspace}
          aria-label={extra.workspace}
          onClick={onBack}
        >
          <MessageCircle size={21} />
        </button>
        <nav aria-label={copy.primaryNav}>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              title={label}
              aria-label={label}
              aria-current={section === id ? "page" : undefined}
              className={section === id ? "selected" : ""}
              onClick={() => {
                setSection(id);
                if (id === "customers") {
                  setView("all");
                  setOffset(0);
                }
              }}
            >
              <Icon size={20} />
            </button>
          ))}
        </nav>
        <button
          className={section === "settings" ? "selected" : ""}
          title={copy.settings}
          aria-label={copy.settings}
          onClick={() => setSection("settings")}
        >
          <Settings size={20} />
        </button>
        <button
          className="oc-back"
          title={extra.workspace}
          aria-label={extra.workspace}
          onClick={onBack}
        >
          <ArrowLeft size={17} />
        </button>
      </aside>
      {section === "inbox" ? (
        <>
          <aside className="oc-sidebar">
            <header>
              <h1>Inbox</h1>
              <button
                className="oc-close-sidebar"
                aria-label={copy.back}
                onClick={() => setSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="oc-user-line">
              <span>{user.name.split(" ")[0]}</span>
              <small>neurodiversa</small>
            </div>
            <div className="oc-site-card">
              <label htmlFor="oc-site">Site Olivia</label>
              <select id="oc-site" value="neurodiversa" onChange={() => {}}>
                <option value="neurodiversa">Neuro Diversa</option>
              </select>
              <a
                href="https://neurodiversa.mx/"
                target="_blank"
                rel="noreferrer"
              >
                neurodiversa.mx <ExternalLink size={11} />
              </a>
            </div>
            <div className="oc-sync-card">
              <div>
                <strong className={loadError ? "failed" : ""}>
                  {loadError ? extra.refresh : copy.liveAuto}
                </strong>
                <span>{summary.counts.all || 0}</span>
              </div>
              <button
                onClick={() => void loadList()}
                aria-label={extra.refresh}
              >
                {summary.syncedAt
                  ? `Sync ${new Intl.DateTimeFormat(langLocale[language], { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(summary.syncedAt))}`
                  : copy.syncing}
                <RefreshCw size={11} />
              </button>
              {loadError && <p role="alert">{loadError}</p>}
            </div>
            <section className="oc-nav-section">
              <h2>
                {copy.liveConversations}
                <ChevronDown size={13} />
              </h2>
              {views.map(([id, label, icon]) => (
                <button
                  key={id}
                  className={view === id ? "selected" : ""}
                  onClick={() => chooseView(id)}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                  <b>{summary.counts[id] || 0}</b>
                </button>
              ))}
              <button
                className={view === "mine" ? "selected" : ""}
                onClick={() => chooseView("mine")}
              >
                <UserRound size={14} />
                <span>{extra.mine}</span>
                <b>{summary.counts.mine || 0}</b>
              </button>
            </section>
            <section className="oc-nav-section oc-ticket-section">
              <h2>
                {copy.tickets}
                <ChevronDown size={13} />
              </h2>
              <div className="oc-channel-card">
                <p>{copy.ticketsText}</p>
                <button
                  onClick={() => {
                    setSection("settings");
                    setModal("connect");
                  }}
                >
                  {copy.connectMailbox}
                </button>
              </div>
            </section>
            <section className="oc-nav-section">
              <h2>
                {copy.savedViews}
                <ChevronDown size={13} />
              </h2>
              {[
                ["whatsapp", MessageCircle, "WhatsApp"],
                ["facebook", MessageCircle, "Facebook Messenger"],
                ["instagram", AtSign, "Instagram"],
              ].map(([key, Icon, label]) => {
                const ChannelIcon = Icon as typeof MessageCircle;
                return (
                  <button
                    key={key as string}
                    className={`oc-social-channel ${key}`}
                    onClick={() => {
                      setSection("settings");
                      setModal("connect");
                    }}
                  >
                    <ChannelIcon size={15} />
                    <span>{label as string}</span>
                    <small>{copy.configure}</small>
                  </button>
                );
              })}
              <div className="oc-channel-card">
                <p>{copy.socialChannelsText}</p>
                <button onClick={() => setSection("settings")}>
                  {copy.connectSocialChannels}
                </button>
              </div>
            </section>
          </aside>
          <section className="oc-list">
            <header>
              <button
                className="oc-toggle-filters"
                aria-label={copy.liveConversations}
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft size={19} />
              </button>
              <label>
                <Search size={17} />
                <input
                  aria-label={copy.search}
                  placeholder={copy.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </header>
            <h2>
              <Inbox size={20} />
              {view === "mine"
                ? extra.mine
                : views.find((v) => v[0] === view)?.[1] || copy.all}
              <span>{summary.total}</span>
            </h2>
            <div className="oc-list-scroll">
              {!loaded ? (
                <div className="oc-list-empty">{copy.loading}</div>
              ) : summary.conversations.length ? (
                summary.conversations.map((c) => (
                  <button
                    key={c.id}
                    className={`oc-thread-row ${selected === c.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelected(c.id);
                      setInfoOpen(false);
                    }}
                  >
                    <span className="oc-thread-avatar">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="oc-thread-excerpt">
                      <span>
                        <strong>{c.name}</strong>
                        <time>{date(c.updated, language)}</time>
                      </span>
                      <small>{extra.web}</small>
                      <p>{c.last_message}</p>
                      <span>
                        <small>Neuro Diversa</small>
                        <StatusPill mode={c.mode} language={language} />
                        {c.unread > 0 && (
                          <b className="oc-unread">{c.unread}</b>
                        )}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="oc-list-empty">
                  <MessageCircle size={25} />
                  <strong>{copy.noConversationTitle}</strong>
                  <p>{copy.noConversation}</p>
                </div>
              )}
            </div>
            <footer className="oc-pagination">
              {offset > 0 && (
                <button
                  aria-label="Previous page"
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  <ChevronLeft size={15} />
                </button>
              )}
              <span>
                {summary.total
                  ? `${offset + 1}–${Math.min(offset + 50, summary.total)} / ${summary.total}`
                  : "0"}
              </span>
              {summary.nextOffset !== null && (
                <button
                  aria-label="Next page"
                  onClick={() => setOffset(summary.nextOffset!)}
                >
                  <ChevronRight size={15} />
                </button>
              )}
            </footer>
          </section>
          <section className="oc-chat">
            <header>
              <div className="oc-client-heading">
                <button
                  className="oc-mobile-back"
                  aria-label={copy.back}
                  onClick={() => setSelected("")}
                >
                  <ChevronLeft size={20} />
                </button>
                <span>{copy.client}</span>
                <i>ND</i>
                <strong>Neuro Diversa</strong>
              </div>
              <div className="oc-thread-actions">
                <button
                  disabled={!thread || busy}
                  onClick={() =>
                    void perform(() =>
                      status(thread?.mode === "closed" ? "ai" : "closed"),
                    )
                  }
                >
                  <Check size={15} />
                  {thread?.mode === "closed" ? extra.reopen : copy.solve}
                </button>
                <button
                  className={`oc-takeover ${manual ? "manual" : ""}`}
                  disabled={!thread || busy}
                  onClick={() =>
                    void perform(() => status(manual && me ? "ai" : "manual"))
                  }
                >
                  {manual && me ? copy.returnAi : copy.takeover}
                </button>
                <div className="oc-menu-wrap">
                  <button
                    aria-label={extra.more}
                    disabled={!thread}
                    aria-expanded={menu}
                    onClick={() => setMenu((v) => !v)}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menu && (
                    <div className="oc-action-menu">
                      <button onClick={exportTranscript}>
                        <Download size={14} />
                        {extra.export}
                      </button>
                      <button
                        onClick={() =>
                          void perform(async () => {
                            await navigator.clipboard.writeText(
                              new URL(
                                `/inbox/?conversation=${selected}`,
                                location.origin,
                              ).toString(),
                            );
                            setMenu(false);
                          })
                        }
                      >
                        <Copy size={14} />
                        {extra.link}
                      </button>
                      <button
                        onClick={() =>
                          void perform(async () => {
                            await api(
                              `admin/channel/conversations/${selected}/read`,
                              { unread: true },
                            );
                            lastRead.current = "";
                            setMenu(false);
                            await loadList();
                          })
                        }
                      >
                        <Mail size={14} />
                        {extra.unread}
                      </button>
                      <button
                        onClick={() => {
                          setModal("profile");
                          setMenu(false);
                        }}
                      >
                        <UserRound size={14} />
                        {extra.edit}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="oc-header-right">
                <select
                  aria-label="Language"
                  value={language}
                  onChange={(e) => {
                    const value = e.target.value as ChannelLanguage;
                    setLanguage(value);
                    try {
                      localStorage.setItem("oliviaInboxLanguage", value);
                    } catch {}
                  }}
                >
                  <option value="fr">FR</option>
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
                <button
                  aria-label={copy.info}
                  className="oc-toggle-info"
                  onClick={() => setInfoOpen((v) => !v)}
                >
                  <PanelRight size={18} />
                </button>
              </div>
            </header>
            <div className="oc-context-banner">
              <CircleHelp size={14} />
              {thread ? (
                <span>
                  {copy.conversationFrom} neurodiversa.mx.{" "}
                  {thread.mode === "manual"
                    ? copy.manualPaused
                    : thread.mode === "closed"
                      ? extra.solved
                      : extra.liveAi}
                </span>
              ) : (
                copy.waiting
              )}
            </div>
            <div className="oc-timeline" ref={timelineRef}>
              {thread && detail ? (
                <>
                  <div className="oc-date-divider">
                    <i />
                    {date(thread.created, language, true)}
                    <i />
                  </div>
                  {thread.lead_message && (
                    <article className="oc-request-card">
                      <span>{extra.service}</span>
                      <p>{thread.lead_message}</p>
                    </article>
                  )}
                  {detail.messages.map((message) => (
                    <MessageBlock
                      key={message.id}
                      message={message}
                      thread={thread}
                      language={language}
                    />
                  ))}
                  {!detail.messages.length && (
                    <p className="oc-no-messages">{copy.sendFirstMessage}</p>
                  )}
                </>
              ) : (
                <div className="oc-chat-empty">
                  <MessageCircle size={38} />
                  <h2>{selected ? copy.loading : copy.noConversationTitle}</h2>
                  <p>{loadError || copy.sendFirstMessage}</p>
                </div>
              )}
            </div>
            <footer className="oc-composer">
              <div className="oc-composer-top">
                <MessageSquareText size={15} />
                {copy.liveChat}
                <ChevronDown size={14} />
                <StatusPill mode={thread?.mode || "ai"} language={language} />
                {thread?.assignee_name && (
                  <small>
                    {extra.assigned} {thread.assignee_name}
                  </small>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(send);
                }}
              >
                <textarea
                  ref={replyRef}
                  aria-label={copy.writeReply}
                  value={draft}
                  disabled={!canReply}
                  placeholder={
                    canReply ? copy.writeReply : copy.takeoverToReply
                  }
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                />
                {file && (
                  <div className="oc-file-pending">
                    <Paperclip size={14} />
                    {file.name}
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() => setFile(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="oc-composer-bottom">
                  <div className="oc-tools">
                    <button
                      type="button"
                      disabled={!thread || toolBusy}
                      aria-label={copy.tools.suggest}
                      title={copy.tools.suggest}
                      onClick={() => void assist("reply")}
                    >
                      <Bot size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={!thread}
                      aria-label={copy.tools.greeting}
                      title={copy.tools.greeting}
                      onClick={() => {
                        setDraft(copy.greetingText);
                        replyRef.current?.focus();
                      }}
                    >
                      <Wand2 size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={!thread}
                      aria-label={copy.tools.quick}
                      title={copy.tools.quick}
                      onClick={() => setModal("quick")}
                    >
                      <Zap size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={!canReply}
                      aria-label={copy.tools.focus}
                      title={copy.tools.focus}
                      onClick={() => replyRef.current?.focus()}
                    >
                      <Command size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={!canReply}
                      aria-label={copy.tools.attach}
                      title={copy.tools.attach}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Paperclip size={16} />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="oc-hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
                      aria-label={copy.attachment}
                      onChange={(e) => {
                        const chosen = e.target.files?.[0];
                        if (chosen && chosen.size > 2000000)
                          notify(copy.attachmentTooLarge);
                        else if (chosen) setFile(chosen);
                        e.target.value = "";
                      }}
                    />
                    {toolBusy && (
                      <span className="oc-tool-loading">{copy.analyzing}</span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="oc-send"
                    disabled={!canReply || (!draft.trim() && !file)}
                  >
                    <Send size={15} />
                    {copy.reply}
                  </button>
                </div>
              </form>
            </footer>
          </section>
          <aside className="oc-info">
            <header role="tablist" aria-label={copy.customerData}>
              {[
                ["info", copy.info],
                ["pages", copy.viewedPages],
                ["notes", copy.notes],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={infoTab === id}
                  className={infoTab === id ? "selected" : ""}
                  onClick={() => setInfoTab(id)}
                >
                  {label}
                  {id === "notes" && !!detail?.notes.length && (
                    <small>{detail.notes.length}</small>
                  )}
                </button>
              ))}
              <button
                className="oc-info-close"
                aria-label={extra.back}
                onClick={() => setInfoOpen(false)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="oc-info-scroll">
              {infoTab === "info" ? (
                <>
                  <section>
                    <div className="oc-info-title">
                      <h2>{copy.customerData}</h2>
                      <button
                        disabled={!thread}
                        aria-label={extra.edit}
                        onClick={() => setModal("profile")}
                      >
                        <UserRound size={13} />
                      </button>
                    </div>
                    <div className="oc-customer-lines">
                      <div>
                        <UserRound size={15} />
                        <span>{thread?.name || "—"}</span>
                      </div>
                      <div>
                        <Mail size={15} />
                        {thread?.email ? (
                          <a href={`mailto:${thread.email}`}>{thread.email}</a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <MessageCircle size={15} />
                        {thread?.phone ? (
                          <a href={`tel:${thread.phone}`}>{thread.phone}</a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <Tag size={15} />
                        <button
                          disabled={!thread}
                          onClick={() => setTagOpen((v) => !v)}
                        >
                          {copy.addTag}
                        </button>
                      </div>
                    </div>
                    {!!thread?.tags.length && (
                      <div className="oc-tag-list">
                        {thread.tags.map((label) => (
                          <span key={label}>
                            {label}
                            <button
                              aria-label={`${extra.cancel} ${label}`}
                              disabled={busy}
                              onClick={() =>
                                void perform(() =>
                                  saveTags(
                                    thread.tags.filter((t) => t !== label),
                                  ),
                                )
                              }
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {tagOpen && (
                      <form
                        className="oc-tag-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (thread && tag.trim())
                            void perform(() =>
                              saveTags([...thread.tags, tag.trim()]),
                            );
                        }}
                      >
                        <input
                          aria-label={extra.tags}
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          maxLength={40}
                          placeholder={extra.tags}
                          autoFocus
                        />
                        <button disabled={busy || !tag.trim()}>
                          <Plus size={15} />
                        </button>
                      </form>
                    )}
                  </section>
                  <section>
                    <h2>{copy.bookingContext}</h2>
                    <dl>
                      {[
                        [extra.assigned, thread?.assignee_name || "Olivia AI"],
                        [extra.service, thread?.interest || "—"],
                        [extra.source, extra.web],
                        ["page", thread?.page || "—"],
                        ["site", "neurodiversa.mx"],
                        [extra.title, detail?.pages[0]?.title || "—"],
                        [
                          extra.consent,
                          thread?.consent_at
                            ? date(thread.consent_at, language, true)
                            : "—",
                        ],
                        ["language", thread?.language.toUpperCase() || "—"],
                      ].map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section>
                    <h2>{copy.lastViewed}</h2>
                    <p className="oc-last-page">
                      {detail?.pages[0]?.title || thread?.page || "—"}
                    </p>
                    <button
                      className="oc-text-link"
                      onClick={() => setInfoTab("pages")}
                    >
                      {copy.seeHistory}
                    </button>
                  </section>
                </>
              ) : infoTab === "pages" ? (
                <section>
                  <h2>{copy.viewedPages}</h2>
                  {detail?.pages.length ? (
                    <ol className="oc-page-history">
                      {detail.pages.map((visit) => (
                        <li key={visit.id}>
                          <Globe size={15} />
                          <div>
                            <a
                              href={`https://neurodiversa.mx${visit.path}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {visit.title || visit.path}
                              <ExternalLink size={11} />
                            </a>
                            <span>{visit.path}</span>
                            <time>
                              {date(visit.created, language, true)} ·{" "}
                              {date(visit.created, language)}
                            </time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="oc-muted">{extra.pages}</p>
                  )}
                </section>
              ) : (
                <section>
                  <h2>{copy.notes}</h2>
                  {thread?.followup_note && (
                    <article className="oc-internal-note">
                      <strong>{extra.privateNote}</strong>
                      <p>{thread.followup_note}</p>
                    </article>
                  )}
                  {detail?.notes.map((item) => (
                    <article className="oc-internal-note" key={item.id}>
                      <header>
                        <strong>{item.author}</strong>
                        <time>{date(item.created, language)}</time>
                      </header>
                      <p>{item.content}</p>
                    </article>
                  ))}
                  <form
                    className="oc-note-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!note.trim()) return;
                      void perform(async () => {
                        await api(
                          `admin/channel/conversations/${selected}/notes`,
                          { id: crypto.randomUUID(), content: note },
                        );
                        setNote("");
                        await loadDetail(selected);
                        notify(extra.newNote);
                      });
                    }}
                  >
                    <textarea
                      aria-label={extra.privateNote}
                      disabled={!thread}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={extra.notePlaceholder}
                      maxLength={4000}
                    />
                    <button disabled={!thread || !note.trim() || busy}>
                      {extra.addNote}
                    </button>
                  </form>
                </section>
              )}
            </div>
          </aside>
        </>
      ) : (
        <section className="oc-workspace-panel">
          <header>
            <div>
              <span>OLIVIA AI · 3.6</span>
              <h1>
                {section === "settings"
                  ? copy.settings
                  : nav.find((n) => n[0] === section)?.[1]}
              </h1>
            </div>
            <button onClick={() => setSection("inbox")}>
              <ChevronLeft size={15} />
              {copy.back}
            </button>
          </header>
          <div className="oc-panel-content">
            {section === "analytics" ? (
              <>
                <div className="oc-stat-grid">
                  {[
                    [copy.conversations, summary.counts.all],
                    [copy.open, summary.counts.open],
                    [copy.aiManaged, summary.counts.ai],
                    [copy.manualManaged, summary.counts.manual],
                  ].map(([label, count]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong>{count || 0}</strong>
                    </article>
                  ))}
                </div>
                <article className="oc-panel-card">
                  <h2>
                    <BarChart3 size={20} />
                    {copy.nav[3]}
                  </h2>
                  <dl>
                    {[
                      [copy.views[0], summary.counts.unassigned],
                      [copy.views[2], summary.counts.solved],
                      [extra.mine, summary.counts.mine],
                    ].map(([label, count]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{count || 0}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </>
            ) : section === "automation" ? (
              <form
                className="oc-panel-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!automation) return;
                  void perform(async () => {
                    await api("admin/channel/settings", automation, "PUT");
                    const next = await api<ChannelSettings>(
                      "admin/channel/settings",
                    );
                    setSettings(next);
                    setAutomation(next.automation);
                    notify(extra.save);
                  });
                }}
              >
                <h2>
                  <Bot size={21} />
                  {copy.nav[1]}
                </h2>
                {automation && (
                  <>
                    <label className="oc-setting-switch">
                      <span>
                        <strong>{extra.automatic}</strong>
                        <small>{copy.automations[0][1]}</small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        disabled={user.role !== "owner"}
                        checked={automation.autoReply}
                        onChange={(e) =>
                          setAutomation((a) =>
                            a ? { ...a, autoReply: e.target.checked } : a,
                          )
                        }
                      />
                    </label>
                    <label className="oc-setting-switch">
                      <span>
                        <strong>{extra.handoff}</strong>
                        <small>{copy.automations[2][1]}</small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        disabled={user.role !== "owner"}
                        checked={automation.humanHandoff}
                        onChange={(e) =>
                          setAutomation((a) =>
                            a ? { ...a, humanHandoff: e.target.checked } : a,
                          )
                        }
                      />
                    </label>
                    <div className="oc-consent-rule">
                      <ShieldCheck size={19} />
                      <span>{copy.automations[3][1]}</span>
                    </div>
                    <h3>{copy.tools.quick}</h3>
                    {automation.quickReplies.map((text, index) => (
                      <textarea
                        key={index}
                        className="oc-quick-text"
                        disabled={user.role !== "owner"}
                        aria-label={`${copy.tools.quick} ${index + 1}`}
                        value={text}
                        maxLength={1000}
                        onChange={(e) =>
                          setAutomation((a) =>
                            a
                              ? {
                                  ...a,
                                  quickReplies: a.quickReplies.map((r, i) =>
                                    i === index ? e.target.value : r,
                                  ),
                                }
                              : a,
                          )
                        }
                      />
                    ))}
                    <button
                      className="oc-primary-button"
                      disabled={busy || user.role !== "owner"}
                    >
                      {extra.save}
                    </button>
                  </>
                )}
              </form>
            ) : section === "customers" ? (
              <div className="oc-customers-table">
                <header>
                  {summary.counts.all || 0} {copy.visitors}
                </header>
                {summary.conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setSection("inbox");
                    }}
                  >
                    <span>{c.name}</span>
                    <span>{c.email || "—"}</span>
                    <span>{c.phone || "—"}</span>
                    <StatusPill mode={c.mode} language={language} />
                  </button>
                ))}
              </div>
            ) : section === "copilot" ? (
              <article className="oc-panel-card">
                <h2>
                  <Sparkles size={21} />
                  {copy.aiBrief}
                </h2>
                <p>{thread?.name || copy.noConversation}</p>
                <span className="oc-engine-label">Olivia AI 3.6</span>
                <button
                  className="oc-primary-button"
                  disabled={!thread || toolBusy}
                  onClick={() => void assist("summary")}
                >
                  {toolBusy ? copy.analyzing : copy.analyze}
                </button>
                {analysis && (
                  <div className="oc-analysis-result">{analysis}</div>
                )}
              </article>
            ) : (
              <>
                <article className="oc-panel-card">
                  <h2>
                    <ShieldCheck size={21} />
                    {copy.accountSecurity}
                  </h2>
                  <p>
                    {user.name} · {user.email}
                  </p>
                  <button className="oc-primary-button" onClick={onConnections}>
                    {copy.settings}
                    <ExternalLink size={14} />
                  </button>
                </article>
                <article className="oc-panel-card">
                  <h2>
                    <MessageCircle size={21} />
                    {copy.socialChannels}
                  </h2>
                  <p>{extra.connectText}</p>
                  <div className="oc-channel-settings">
                    {[
                      ["website", extra.web],
                      ["mailbox", "Email"],
                      ["whatsapp", "WhatsApp"],
                      ["facebook", "Facebook Messenger"],
                      ["instagram", "Instagram"],
                    ].map(([id, label]) => (
                      <div key={id}>
                        <span>{label}</span>
                        <span
                          className={
                            settings?.channels[id]?.connected
                              ? "connected"
                              : "pending"
                          }
                        >
                          {settings?.channels[id]?.connected
                            ? extra.configured
                            : copy.configure}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="oc-secondary-button"
                    onClick={() => setModal("connect")}
                  >
                    {copy.connectSocialChannels}
                  </button>
                </article>
              </>
            )}
          </div>
        </section>
      )}
      {(sidebarOpen || infoOpen) && (
        <button
          className="oc-drawer-shade"
          aria-label={extra.back}
          onClick={() => {
            setSidebarOpen(false);
            setInfoOpen(false);
          }}
        />
      )}
      {modal === "profile" && thread && (
        <Modal title={extra.profile} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              void perform(async () => {
                await api(
                  `admin/channel/conversations/${selected}/profile`,
                  data,
                  "PATCH",
                );
                setModal(null);
                await refresh();
              });
            }}
          >
            {[
              [
                "name",
                language === "fr"
                  ? "Nom"
                  : language === "en"
                    ? "Name"
                    : "Nombre",
                thread.name,
              ],
              ["email", "Email", thread.email],
              [
                "phone",
                language === "fr"
                  ? "Téléphone"
                  : language === "en"
                    ? "Phone"
                    : "Teléfono",
                thread.phone,
              ],
            ].map(([name, label, value]) => (
              <label key={name} className="nd-field">
                {label}
                <input
                  name={name}
                  type={name === "email" ? "email" : "text"}
                  defaultValue={value}
                  required={name === "name"}
                  maxLength={name === "phone" ? 40 : 200}
                />
              </label>
            ))}
            <button className="oc-primary-button" disabled={busy}>
              {extra.save}
            </button>
          </form>
        </Modal>
      )}
      {modal === "quick" && (
        <Modal title={copy.tools.quick} onClose={() => setModal(null)}>
          <div className="oc-quick-replies">
            {(
              settings?.automation.quickReplies || [
                copy.greetingText,
                copy.quickText,
              ]
            ).map((text, index) => (
              <button
                key={index}
                onClick={() => {
                  setDraft(text);
                  setModal(null);
                  replyRef.current?.focus();
                }}
              >
                {text}
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "connect" && (
        <Modal title={extra.connect} onClose={() => setModal(null)}>
          <p className="oc-connect-description">{extra.connectText}</p>
          <div className="oc-channel-settings">
            {[
              ["mailbox", "Email"],
              ["whatsapp", "WhatsApp"],
              ["facebook", "Facebook Messenger"],
              ["instagram", "Instagram"],
            ].map(([id, label]) => (
              <div key={id}>
                <span>{label}</span>
                <span className="pending">{copy.configure}</span>
              </div>
            ))}
          </div>
          <button className="oc-primary-button" onClick={() => setModal(null)}>
            {extra.back}
          </button>
        </Modal>
      )}
    </div>
  );
}
