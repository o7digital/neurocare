// Three-pane channel console follows suitesmine-bot/app/inbox; uses this site's private API.
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Send,
  Mail,
  Phone,
  MessageSquare,
  Users,
  Bot,
  UserRound,
  ArrowLeft,
} from "lucide-react";
import { api, formatDate, statusLabel } from "./api";
import { Badge, Empty } from "./ui";
import type { Lead, Conversation, Message } from "./types";
export default function Inbox({
  channel = false,
  notify,
}: {
  channel?: boolean;
  notify: (message: string) => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [note, setNote] = useState(""),
    [status, setStatus] = useState("new"),
    [reply, setReply] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [mode, setMode] = useState("ai");
  const load = useCallback(async () => {
    const data = await api<{ leads: Lead[]; conversations: Conversation[] }>(
      "admin/inbox",
    );
    setLeads(data.leads);
    setConversations(data.conversations);
    setLoaded(true);
    return data;
  }, []);
  useEffect(() => {
    void load().catch((e) => notify(e.message));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  const lead = leads.find((l) => l.visitor_id === selected),
    conversation = conversations.find((c) => c.id === selected);
  useEffect(() => {
    setNote(lead?.note || "");
    setStatus(lead?.status || "new");
  }, [selected, lead?.note, lead?.status]);
  useEffect(() => {
    setMode(lead?.mode || conversation?.mode || "ai");
  }, [selected, lead?.mode, conversation?.mode]);
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    let alive = true;
    const refresh = () =>
      api<{ messages: Message[] }>(`admin/conversations/${selected}`)
        .then((d) => {
          if (alive) setMessages(d.messages);
        })
        .catch((e) => {
          if (alive) notify(e.message);
        });
    setMessages([]);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [selected]);
  const action = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const candidates = channel
    ? [
        ...conversations.map((c) => ({
          id: c.id,
          lead: leads.find((l) => l.visitor_id === c.id),
          conversation: c,
        })),
        ...leads
          .filter((l) => !conversations.some((c) => c.id === l.visitor_id))
          .map((l) => ({ id: l.visitor_id, lead: l, conversation: undefined })),
      ]
    : leads.map((l) => ({
        id: l.visitor_id,
        lead: l,
        conversation: conversations.find((c) => c.id === l.visitor_id),
      }));
  const visible = candidates.filter((item) => {
    const l = item.lead;
    return (
      `${l?.first_name || ""} ${l?.last_name || ""} ${l?.email || ""} ${item.conversation?.last_message || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (channel
          ? (l?.mode || item.conversation?.mode) === filter
          : filter === "group"
            ? l?.interest === "group"
            : l?.status === filter))
    );
  });
  return (
    <div className="inbox-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">OLIVIA AI · 3.6</span>
          <h1>{channel ? "Channel manager" : "Inbox de pacientes"}</h1>
          <p>
            {channel
              ? "Conversaciones del sitio y atención del equipo."
              : "Solicitudes recibidas desde Olivia y el programa grupal."}
          </p>
        </div>
        <button
          className="nd-button"
          onClick={() =>
            void action(async () => {
              await load();
              notify("Inbox actualizado.");
            })
          }
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>
      <div className="inbox-metrics">
        <div>
          <Users size={18} />
          <strong>{leads.length}</strong>
          <span>Solicitudes</span>
        </div>
        <div>
          <span className="metric-dot" />
          <strong>{leads.filter((l) => l.status === "new").length}</strong>
          <span>Por contactar</span>
        </div>
        <div>
          <MessageSquare size={18} />
          <strong>{conversations.length}</strong>
          <span>Conversaciones</span>
        </div>
        <div>
          <Bot size={18} />
          <strong>{leads.filter((l) => l.interest === "group").length}</strong>
          <span>Interés en el grupo</span>
        </div>
      </div>
      <section className={`inbox-console ${selected ? "has-selection" : ""}`}>
        <aside className="conversation-list">
          <div className="inbox-search">
            <Search size={16} />
            <input
              aria-label="Buscar en inbox"
              placeholder="Buscar nombre, correo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar inbox"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">
              {channel ? "Todas las conversaciones" : "Todas las solicitudes"}
            </option>
            {(channel
              ? ["ai", "manual", "closed"]
              : ["new", "contacted", "enrolled", "group", "closed"]
            ).map((v) => (
              <option key={v} value={v}>
                {statusLabel[v] || v}
              </option>
            ))}
          </select>
          <div className="conversation-scroll">
            {!loaded ? (
              <p className="loading-line">Cargando inbox…</p>
            ) : !visible.length ? (
              <Empty
                title={query ? "Sin resultados" : "Tu inbox está al día"}
                icon={MessageSquare}
              >
                Las solicitudes que reciba Olivia aparecerán aquí
                automáticamente.
              </Empty>
            ) : (
              visible.map(({ id, lead: l, conversation: c }) => (
                <button
                  key={id}
                  className={`conversation-row ${selected === id ? "active" : ""}`}
                  onClick={() => setSelected(id)}
                >
                  <span className="contact-avatar">
                    {l ? (
                      `${l.first_name[0]}${l.last_name[0]}`
                    ) : (
                      <MessageSquare size={18} />
                    )}
                  </span>
                  <span className="conversation-copy">
                    <strong>
                      {l
                        ? `${l.first_name} ${l.last_name}`
                        : "Visitante del sitio"}
                    </strong>
                    <small>
                      {l
                        ? statusLabel[l.interest]
                        : c?.last_message?.slice(0, 65)}
                    </small>
                    <span>
                      <Badge
                        value={
                          channel
                            ? l?.mode || c?.mode || "ai"
                            : l?.status || "new"
                        }
                      />
                      <time>
                        {
                          formatDate(l?.updated || c?.updated || "").split(
                            ",",
                          )[0]
                        }
                      </time>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
        <main className="conversation-main">
          {!selected ? (
            <Empty title="Selecciona una conversación" icon={MessageSquare}>
              Consulta el historial, responde como equipo y da seguimiento desde
              un mismo lugar.
            </Empty>
          ) : (
            <>
              <header>
                <button
                  className="icon-button mobile-back"
                  aria-label="Volver a la lista"
                  onClick={() => setSelected("")}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <strong>
                    {lead
                      ? `${lead.first_name} ${lead.last_name}`
                      : "Visitante del sitio"}
                  </strong>
                  <small>
                    {lead
                      ? statusLabel[lead.interest]
                      : "Chat de neurodiversa.mx"}
                  </small>
                </div>
                <label className="mode-selector">
                  <span
                    className={`live-dot ${mode === "ai" ? "online" : "sleep"}`}
                  />
                  <select
                    aria-label="Modo de atención"
                    value={mode}
                    disabled={busy}
                    onChange={(e) =>
                      void action(async () => {
                        await api(
                          `admin/conversations/${selected}`,
                          { mode: e.target.value },
                          "PATCH",
                        );
                        setMode(e.target.value);
                        await load();
                      })
                    }
                  >
                    <option value="ai">Olivia AI</option>
                    <option value="manual">Equipo</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </label>
              </header>
              <div className="message-timeline">
                {lead && (
                  <article className="lead-summary">
                    <span className="eyebrow">SOLICITUD DEL SITIO</span>
                    <p>{lead.message}</p>
                    <small>{formatDate(lead.created)}</small>
                  </article>
                )}
                {!messages.length && !lead ? (
                  <p className="muted">
                    Todavía no hay mensajes en esta conversación.
                  </p>
                ) : (
                  messages.map((m) => (
                    <article key={m.id} className={`message-bubble ${m.role}`}>
                      <span>
                        {m.role === "visitor"
                          ? "Visitante"
                          : m.role === "operator"
                            ? "Equipo Neuro Diversa"
                            : "Olivia AI"}
                      </span>
                      <p>{m.content}</p>
                      <time>{formatDate(m.created)}</time>
                    </article>
                  ))
                )}
              </div>
              <form
                className="reply-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await api(`admin/conversations/${selected}`, {
                      content: reply,
                    });
                    setReply("");
                    setMode("manual");
                    const data = await api<{ messages: Message[] }>(
                      `admin/conversations/${selected}`,
                    );
                    setMessages(data.messages);
                    await load();
                  });
                }}
              >
                <textarea
                  aria-label="Responder al paciente"
                  rows={2}
                  placeholder="Responder como equipo…"
                  value={reply}
                  maxLength={4000}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div>
                  <small>
                    <UserRound size={13} /> Al responder, el equipo toma la
                    conversación.
                  </small>
                  <button
                    className="nd-button primary"
                    disabled={busy || !reply.trim()}
                  >
                    <Send size={14} />
                    Enviar respuesta
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
        {selected && (
          <aside className="contact-panel">
            <span className="eyebrow">FICHA DEL CONTACTO</span>
            <div className="contact-profile">
              <span className="contact-avatar large">
                {lead?.first_name[0] || <UserRound size={24} />}
              </span>
              <h3>
                {lead ? `${lead.first_name} ${lead.last_name}` : "Visitante"}
              </h3>
              <Badge value={status} />
            </div>
            {lead ? (
              <>
                <a className="contact-line" href={`mailto:${lead.email}`}>
                  <Mail size={14} />
                  {lead.email}
                </a>
                <a className="contact-line" href={`tel:${lead.phone}`}>
                  <Phone size={14} />
                  {lead.phone}
                </a>
                <hr />
                <label className="nd-field">
                  Seguimiento
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {["new", "contacted", "enrolled", "closed"].map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="nd-field">
                  Nota privada
                  <textarea
                    rows={5}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Próximo paso, disponibilidad…"
                    maxLength={4000}
                  />
                </label>
                <button
                  className="nd-button primary full"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await api(
                        `admin/leads/${lead.id}`,
                        { status, note },
                        "PATCH",
                      );
                      await load();
                      notify("Seguimiento guardado.");
                    })
                  }
                >
                  Guardar seguimiento
                </button>
                <hr />
                <dl>
                  <dt>Interés</dt>
                  <dd>{statusLabel[lead.interest]}</dd>
                  <dt>Idioma</dt>
                  <dd>{lead.language === "en" ? "English" : "Español"}</dd>
                  <dt>Autorización de contacto</dt>
                  <dd>{formatDate(lead.consent_at)}</dd>
                  <dt>Suscripción al boletín</dt>
                  <dd>
                    {lead.marketing_consent ? "Autorizada" : "Sin suscripción"}
                  </dd>
                </dl>
              </>
            ) : (
              <p className="muted">
                Los datos aparecerán cuando el visitante complete su solicitud.
              </p>
            )}
            <p className="contact-origin">
              {lead?.page || conversation?.page || "Sitio web"}
            </p>
          </aside>
        )}
      </section>
    </div>
  );
}
