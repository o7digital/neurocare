// Buffer studio layout and workflow adapted from crm-suitesmine CampaignTools/BufferSyncPanel.
import { useEffect, useState } from "react";
import {
  Layers,
  Plus,
  RefreshCw,
  Send,
  CalendarDays,
  Clock,
  Link,
  Image,
  ArrowUpRight,
  Download,
  Save,
  Heart,
  MessageCircle,
} from "lucide-react";
import { api, formatDate, monthKey } from "./api";
import { newCampaign, normalizeCampaign } from "./templates";
import { Badge, Empty, ImagePicker } from "./ui";
import type { Channel, Workspace, NewsletterCampaign } from "./types";
const createPost = (): NewsletterCampaign => ({
  ...newCampaign(),
  kind: "social",
  subject: "Nueva publicación",
  body: "",
  bodyHtml: "",
  events: [],
  highlights: [],
  heroImage: "",
  mediaUrl: "",
  mode: "draft",
});
function mexicoIso(value: string) {
  const target = new Date(`${value}:00Z`);
  let guess = target.getTime();
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, p.value]),
    );
    const rendered = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
    );
    guess += target.getTime() - rendered;
  }
  return new Date(guess).toISOString();
}
export default function SocialStudio({
  workspace,
  refresh,
  notify,
  onConnections,
}: {
  workspace: Workspace;
  refresh: () => Promise<Workspace>;
  notify: (message: string) => void;
  onConnections: () => void;
}) {
  const posts = workspace.campaigns.filter((c) => c.kind === "social"),
    [post, setPost] = useState<NewsletterCampaign>(() =>
      posts[0] ? normalizeCampaign(posts[0]) : createPost(),
    ),
    [channels, setChannels] = useState<Channel[]>([]),
    [month, setMonth] = useState("all"),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("studio");
  const configured = !!workspace.connections.buffer?.configured;
  const perform = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const loadChannels = async () => {
    const result = await api<{ channels: Channel[] }>("admin/buffer/channels");
    setChannels(result.channels);
  };
  useEffect(() => {
    if (configured) void loadChannels().catch((e) => notify(e.message));
  }, [configured]);
  const patch = (data: Partial<NewsletterCampaign>) =>
    setPost((p) => ({ ...p, ...data }));
  const save = async () => {
    const doc = {
      ...post,
      dueAt:
        post.mode === "scheduled" && post.dueAt && !post.dueAt.endsWith("Z")
          ? mexicoIso(post.dueAt)
          : post.dueAt,
    };
    const saved = await api<{ id: string; version: number }>(
      "admin/campaigns",
      doc,
    );
    const next = { ...doc, ...saved };
    setPost(next);
    await refresh();
    return next;
  };
  const months = [
    ...new Set([monthKey(), ...posts.map((p) => p.monthKey || monthKey())]),
  ].sort();
  const visible = posts.filter((p) => month === "all" || p.monthKey === month);
  const deliveries = workspace.deliveries.filter(
    (d) => d.provider === "buffer",
  );
  const linked = deliveries.filter((d) => d.campaign_id === post.id);
  const localDate = post.dueAt?.endsWith("Z")
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(post.dueAt))
        .replace(" ", "T")
    : post.dueAt;
  return (
    <div className="social-view">
      <div className="module-heading">
        <div>
          <span className="eyebrow">REDES SOCIALES · BUFFER</span>
          <h1>Buffer Studio</h1>
          <p>Prepara el texto y la imagen. Elige tus canales y el momento.</p>
        </div>
        <div className="button-row">
          <button
            className="nd-button"
            onClick={() => void perform(loadChannels)}
            disabled={!configured || busy}
          >
            <RefreshCw size={15} />
            Consultar canales
          </button>
          <button
            className="nd-button primary"
            onClick={() => setPost(createPost())}
          >
            <Plus size={15} />
            Nueva publicación
          </button>
        </div>
      </div>
      <section className="buffer-sync-card">
        <div className="buffer-sync-heading">
          <div>
            <Layers size={19} />
            <span>
              <strong>Campañas por mes</strong>
              <small>
                {workspace.bufferCheckedAt
                  ? `Última consulta: ${formatDate(workspace.bufferCheckedAt)}`
                  : "Estadísticas de tus campañas y publicaciones vinculadas."}
              </small>
            </span>
          </div>
          <button
            className="nd-button"
            disabled={!configured || busy}
            onClick={() =>
              void perform(async () => {
                await api("admin/buffer/sync", {});
                await refresh();
                notify("Estados Buffer actualizados.");
              })
            }
          >
            <RefreshCw size={14} />
            Actualizar estados Buffer
          </button>
        </div>
        <div className="buffer-months">
          {months.map((m) => {
            const campaigns = posts.filter((p) => p.monthKey === m),
              records = deliveries.filter((d) =>
                campaigns.some((p) => p.id === d.campaign_id),
              ),
              known = records.filter(
                (d) => d.remote_id && workspace.bufferRemote[d.remote_id],
              );
            return (
              <button
                key={m}
                className={month === m ? "active" : ""}
                onClick={() => setMonth(month === m ? "all" : m)}
              >
                <span>
                  {new Date(`${m}-15T12:00:00`).toLocaleDateString("es-MX", {
                    month: "long",
                    year: "numeric",
                  })}
                  <ArrowUpRight size={14} />
                </span>
                <strong>
                  {campaigns.length}
                  <small>posts preparados</small>
                </strong>
                <p>
                  {records.length} envío(s) ·{" "}
                  {
                    known.filter(
                      (d) =>
                        workspace.bufferRemote[d.remote_id!]?.status === "sent",
                    ).length
                  }{" "}
                  publicado(s)
                </p>
              </button>
            );
          })}
        </div>
        {!configured && (
          <div className="connection-note">
            Conecta tu cuenta cuando estés listo. Puedes preparar y guardar tus
            publicaciones desde ahora.
            <button onClick={onConnections}>
              Configurar Buffer <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </section>
      <div className="social-layout">
        <aside className="social-library">
          <header>
            <span className="eyebrow">PUBLICACIONES</span>
            <small>{visible.length}</small>
          </header>
          {visible.length ? (
            visible.map((p) => (
              <button
                key={p.id}
                className={post.id === p.id ? "active" : ""}
                onClick={() => setPost(normalizeCampaign(p))}
              >
                {p.mediaUrl ? (
                  <img src={p.mediaUrl} alt="" />
                ) : (
                  <span className="post-placeholder">
                    <Image size={19} />
                  </span>
                )}
                <span>
                  <strong>{p.subject}</strong>
                  <small>
                    {p.month} {p.year}
                  </small>
                  <Badge
                    value={p.mode === "scheduled" ? "scheduled" : "draft"}
                  />
                </span>
              </button>
            ))
          ) : (
            <Empty icon={Layers} title="Prepara tu primera publicación">
              También puedes crear posts desde las actividades de una
              newsletter.
            </Empty>
          )}
        </aside>
        <div className="social-editor-card">
          <div className="editor-card-header">
            <h2>Preparar publicación</h2>
            <Badge value={post.version ? "DRAFT" : "draft"} />
          </div>
          <div className="social-editor-fields">
            <label className="nd-field">
              Nombre interno
              <input
                value={post.subject}
                maxLength={180}
                onChange={(e) => patch({ subject: e.target.value })}
              />
            </label>
            <div className="two-fields">
              <label className="nd-field">
                Mes
                <input
                  type="month"
                  value={post.monthKey}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    patch({
                      monthKey: e.target.value,
                      month: new Date(
                        `${e.target.value}-15T12:00:00`,
                      ).toLocaleDateString("es-MX", { month: "long" }),
                      year: Number(e.target.value.slice(0, 4)),
                    });
                  }}
                />
              </label>
              <label className="nd-field">
                Idioma
                <select
                  value={post.language}
                  onChange={(e) =>
                    patch({ language: e.target.value as "es" | "en" })
                  }
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <label className="nd-field">
              Texto de la publicación
              <textarea
                value={post.body}
                rows={9}
                maxLength={5000}
                onChange={(e) => patch({ body: e.target.value })}
                placeholder="¿Qué quieres compartir?"
              />
              <small className="character-count">
                {post.body.length} / 5 000
              </small>
            </label>
            <ImagePicker
              value={post.mediaUrl}
              onChange={(mediaUrl) => patch({ mediaUrl })}
              workspace={workspace}
              refresh={refresh}
            />
            <label className="nd-field">
              Imagen · URL HTTPS
              <input
                value={post.mediaUrl}
                onChange={(e) => patch({ mediaUrl: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <fieldset className="channel-selector">
              <legend>Canales destinatarios</legend>
              {channels.length ? (
                channels.map((channel) => (
                  <label key={channel.id}>
                    <input
                      type="checkbox"
                      checked={post.channelIds.includes(channel.id)}
                      onChange={(e) =>
                        patch({
                          channelIds: e.target.checked
                            ? [...post.channelIds, channel.id]
                            : post.channelIds.filter((id) => id !== channel.id),
                        })
                      }
                    />
                    <span className={`service-icon ${channel.service}`}>
                      {channel.service.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{channel.displayName || channel.name}</strong>
                      <small>{channel.service}</small>
                    </span>
                  </label>
                ))
              ) : (
                <p>
                  {configured
                    ? "Consulta tus canales para elegir un destino."
                    : "Tus canales aparecerán al conectar Buffer."}
                </p>
              )}
            </fieldset>
            <fieldset className="schedule-options">
              <legend>Destino en Buffer</legend>
              {[
                ["draft", "Borrador", "Revisar en Buffer"],
                ["queue", "Cola", "Siguiente espacio"],
                ["scheduled", "Programar", "Elegir fecha y hora"],
              ].map(([value, label, description]) => (
                <label
                  key={value}
                  className={post.mode === value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="buffer-mode"
                    value={value}
                    checked={post.mode === value}
                    onChange={() =>
                      patch({ mode: value as NewsletterCampaign["mode"] })
                    }
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {post.mode === "scheduled" && (
              <label className="nd-field">
                Fecha y hora · Ciudad de México
                <input
                  type="datetime-local"
                  value={localDate}
                  onChange={(e) => patch({ dueAt: e.target.value })}
                />
              </label>
            )}
            <div className="button-row">
              <button
                className="nd-button"
                disabled={busy || !post.body.trim()}
                onClick={() =>
                  void perform(async () => {
                    await save();
                    notify("Publicación guardada.");
                  })
                }
              >
                <Save size={15} />
                Guardar borrador
              </button>
              <button
                className="nd-button primary"
                disabled={
                  busy ||
                  !configured ||
                  !post.body.trim() ||
                  !post.channelIds.length
                }
                onClick={() =>
                  void perform(async () => {
                    const saved = await save();
                    const response = await api<{
                      results: Array<{ status: string }>;
                    }>(`admin/campaigns/${saved.id}/buffer`, {
                      version: saved.version,
                      confirmed: true,
                    });
                    await refresh();
                    notify(
                      response.results.every(
                        (r) => r.status === "already_recorded",
                      )
                        ? "Esta versión ya está registrada en Buffer."
                        : "Publicación registrada para Buffer. Consulta el seguimiento.",
                    );
                  })
                }
              >
                <Send size={14} />
                {post.mode === "draft"
                  ? "Crear borrador en Buffer"
                  : post.mode === "queue"
                    ? "Añadir a la cola"
                    : "Programar en Buffer"}
              </button>
            </div>
          </div>
        </div>
        <aside className="social-preview-column">
          <div className="social-preview-heading">
            <span className="eyebrow">VISTA PREVIA</span>
            <span>Publicación</span>
          </div>
          <article className="social-post-preview">
            <header>
              <span className="social-avatar">ND</span>
              <span>
                <strong>Neuro Diversa</strong>
                <small>
                  {channels
                    .filter((c) => post.channelIds.includes(c.id))
                    .map((c) => c.service)
                    .join(" · ") || "Vista previa de la publicación"}
                </small>
              </span>
              <span>•••</span>
            </header>
            {post.mediaUrl ? (
              <img src={post.mediaUrl} alt="Vista previa del post" />
            ) : (
              <div className="social-no-image">
                <Image size={36} />
                <span>Añade una imagen desde tu biblioteca</span>
              </div>
            )}
            <div className="social-preview-content">
              <p>
                {post.body || "Tu mensaje aparecerá aquí mientras lo escribes."}
              </p>
            </div>
            <footer>
              <Heart size={19} />
              <MessageCircle size={19} />
              <Send size={19} />
            </footer>
          </article>
          <section className="social-delivery-panel">
            <h3>Seguimiento de esta publicación</h3>
            {linked.length ? (
              linked.map((delivery) => {
                const remote = delivery.remote_id
                  ? workspace.bufferRemote[delivery.remote_id]
                  : undefined;
                return (
                  <div key={delivery.id}>
                    <span>
                      {channels.find((c) => c.id === delivery.target)
                        ?.displayName || delivery.target}
                    </span>
                    <Badge value={remote?.status || delivery.status} />
                    {remote?.dueAt && (
                      <small>
                        <Clock size={12} />
                        {formatDate(remote.dueAt)}
                      </small>
                    )}
                    {remote && remote.text !== post.body && (
                      <button
                        className="nd-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "¿Importar el texto modificado en Buffer a este borrador?",
                            )
                          ) {
                            patch({
                              body: remote.text || post.body,
                              bodyHtml: "",
                            });
                            notify(
                              "Texto importado. Guarda el borrador para conservarlo.",
                            );
                          }
                        }}
                      >
                        <Download size={12} />
                        Importar texto de Buffer
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <p>
                La entrega y el estado remoto aparecerán aquí después del envío.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
