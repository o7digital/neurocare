import { useCallback, useEffect, useRef, useState } from "react";
import {
  Globe,
  Search,
  ExternalLink,
  Upload,
  Check,
  Save,
  Settings,
  Layout,
  Image,
  ChevronRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import { api } from "./api";
import { Empty } from "./ui";
import { mountVisualEditor, visualEditorMarkup } from "./site/visual-editor.js";
import type { SiteData, SiteDraft, SiteField, SitePage } from "./site/types";
const sectionNames: Record<string, string> = {
  navigation: "Navegación",
  footer: "Pie de página",
  page: "Contenido principal",
  inicio: "Inicio",
  equipo: "Nuestro equipo",
  grupos: "Programa grupal",
  motivos: "Acompañamiento",
  experiencia: "Trayectoria",
  contacto: "Contacto",
  "programa-contacto": "Solicitud de información",
};
async function normalizedPhoto(file: File) {
  if (file.size > 25000000)
    throw new Error("Elige una fotografía de hasta 25 MB.");
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw new Error("Usa JPG, PNG, WebP o AVIF.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 2400 / bitmap.width, 2400 / bitmap.height),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo preparar la imagen.")),
        "image/webp",
        0.9,
      ),
    );
    if (blob.size > 2000000)
      throw new Error(
        "La imagen preparada supera 2 MB. Elige una fotografía más pequeña.",
      );
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return base64;
  } finally {
    bitmap.close();
  }
}
export default function SiteStudio({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [data, setData] = useState<SiteData | null>(null),
    [selected, setSelected] = useState(""),
    [locale, setLocale] = useState("es"),
    [query, setQuery] = useState(""),
    [section, setSection] = useState("all"),
    [tab, setTab] = useState("visual"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(0),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    pending = useRef<
      Record<
        string,
        {
          id: string;
          revision: number;
          values: Record<string, string>;
          seo?: SiteDraft["seo"];
        }
      >
    >({}),
    dataRef = useRef(data),
    busyRef = useRef(busy),
    prefs = useRef({
      device: window.innerWidth < 720 ? "mobile" : "desktop",
      locale: "es",
      path: "/",
    }),
    selectedRef = useRef(selected);
  dataRef.current = data;
  busyRef.current = busy;
  selectedRef.current = selected;
  const load = useCallback(async () => {
    const value = await api<SiteData>("admin/site/pages");
    setData(value);
    dataRef.current = value;
    setSelected(
      (current) =>
        current ||
        value.pages.find((p) => p.path === "/")?.id ||
        value.pages.find((p) => p.path)?.id ||
        "",
    );
    setError("");
    return value;
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  const page = data?.pages.find((p) => p.id === selected),
    pages = (data?.pages || [])
      .filter(
        (p) =>
          p.path &&
          p.locale === locale &&
          `${p.title} ${p.path}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      )
      .sort((a, b) => {
        const rank = (p: SitePage) =>
          p.path === "/" || p.path === "/en/"
            ? 0
            : p.path?.includes("program")
              ? 1
              : p.path?.includes("blog")
                ? 2
                : 3;
        return (
          rank(a) - rank(b) || String(a.path).localeCompare(String(b.path))
        );
      });
  const relevant = (data?.pages || []).filter(
      (p) =>
        p.id === selected ||
        p.id === `global-${page?.locale}` ||
        p.id === "global-program",
    ),
    fields = relevant.flatMap((p) => p.catalog),
    visibleFields = fields.filter(
      (f) => section === "all" || f.section === section,
    );
  const fieldMap = useRef(new Map<string, SiteField>());
  fieldMap.current = new Map(fields.map((f) => [f.id, f]));
  const valueOf = (id: string) => {
    const f = fieldMap.current.get(id);
    if (!f) return "";
    const doc = dataRef.current?.pages.find((p) => p.id === f.document);
    return (
      pending.current[f.document]?.values[id] ??
      doc?.draft?.values?.[id] ??
      f.source
    );
  };
  const mark = (field: SiteField, value: string) => {
    const doc = dataRef.current?.pages.find((p) => p.id === field.document);
    if (!doc) return;
    pending.current[field.document] ??= {
      id: doc.id,
      revision: doc.revision,
      values: {},
    };
    pending.current[field.document].values[field.id] = value;
    setDirty(
      Object.values(pending.current).reduce(
        (n, p) => n + Object.keys(p.values).length + (p.seo ? 1 : 0),
        0,
      ),
    );
  };
  const save = async () => {
    const documents = Object.values(pending.current);
    if (!documents.length) return;
    if (busyRef.current) return;
    setBusy(true);
    try {
      await api("admin/site/save", { documents });
      pending.current = {};
      setDirty(0);
      await load();
      notify("Cambios guardados en Directus.");
    } finally {
      setBusy(false);
    }
  };
  const execute = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    const check = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: Event) => {
      if (
        Object.keys(pending.current).length &&
        !confirm("Hay cambios sin guardar. ¿Quieres salir del editor?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", check);
    window.addEventListener("neurodiversa:before-navigation", navigate);
    return () => {
      window.removeEventListener("beforeunload", check);
      window.removeEventListener("neurodiversa:before-navigation", navigate);
    };
  }, []);
  useEffect(() => {
    if (!root.current || !page || tab !== "visual") return;
    const element = document.createElement("div");
    element.className = "site-editor-mount";
    element.innerHTML = visualEditorMarkup();
    root.current.replaceChildren(element);
    prefs.current.path = page.path || "/";
    prefs.current.locale = page.locale;
    const handle = mountVisualEditor(element, {
      section: {
        title:
          section === "all" ? page.title : sectionNames[section] || section,
        anchor:
          section === "all" ||
          ["navigation", "footer", "page"].includes(section)
            ? ""
            : section,
      },
      rows: visibleFields
        .filter((f) => f.kind !== "image")
        .map((f) => ({
          label: f.label,
          target: { key: f.id },
          rich: f.kind === "text",
        })),
      photos: visibleFields
        .filter((f) => f.kind === "image")
        .map((f) => ({ collection: f.document, id: f.key, label: f.label })),
      valueOf: (t) => valueOf(t.key),
      photoOf: (row) => {
        const value = valueOf(`${row.collection}:${row.id}`);
        return value.startsWith("cms:")
          ? `/api/admin/site/asset/${value.slice(4)}`
          : value;
      },
      onText: (target, value) => {
        const field = fieldMap.current.get(target.key);
        if (field) mark(field, value);
      },
      onPhoto: async (row, file) => {
        const field = fieldMap.current.get(`${row.collection}:${row.id}`);
        if (!field) return;
        const base64 = await normalizedPhoto(file),
          image = await api<{ id: string }>("admin/site/upload", {
            name: file.name,
            base64,
          });
        mark(field, `cms:${image.id}`);
      },
      onSave: save,
      prefs: prefs.current,
      dirtyCount: () =>
        Object.values(pending.current).reduce(
          (n, p) => n + Object.keys(p.values).length + (p.seo ? 1 : 0),
          0,
        ),
      busy: () => busyRef.current,
    });
    return () => handle.destroy();
  }, [selected, section, tab, data]);
  const patchSeo = (values: Partial<NonNullable<SiteDraft["seo"]>>) => {
    if (!page) return;
    pending.current[page.id] ??= {
      id: page.id,
      revision: page.revision,
      values: {},
    };
    pending.current[page.id].seo = {
      ...page.draft.seo,
      ...pending.current[page.id].seo,
      ...values,
    };
    setDirty(
      Object.values(pending.current).reduce(
        (n, p) => n + Object.keys(p.values).length + (p.seo ? 1 : 0),
        0,
      ),
    );
  };
  const published = relevant.every(
    (p) => data?.publishedRevisions?.[p.id] === p.revision,
  );
  const seo = { ...page?.draft.seo, ...pending.current[selected]?.seo };
  const publish = async () => {
    await save();
    setBusy(true);
    try {
      const current = dataRef.current;
      if (!current) return;
      const targets = current.pages
        .filter(
          (p) =>
            p.id === selected ||
            p.id === `global-${page?.locale}` ||
            p.id === "global-program",
        )
        .map((p) => ({ id: p.id, revision: p.revision }));
      await api("admin/site/publish", { confirmed: true, documents: targets });
      await load();
      notify("Página publicada. El sitio ya usa esta versión.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="site-studio">
      <header className="site-studio-heading">
        <div>
          <span className="eyebrow">NEURO DIVERSA · DIRECTUS</span>
          <h1>Estudio del sitio</h1>
          <p>Edita sobre tus páginas. Guarda y publica cuando estén listas.</p>
        </div>
        <div className="button-row">
          <button
            className="nd-button"
            disabled={busy || !dirty}
            onClick={() => void execute(save)}
          >
            <Save size={15} />
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            className="nd-button primary"
            disabled={busy || !data}
            onClick={() => void execute(publish)}
          >
            <Upload size={15} />
            Publicar página
          </button>
        </div>
      </header>
      {error ? (
        <div className="site-studio-error">
          <Empty title="No se pudo abrir Directus" icon={Globe}>
            {error}
          </Empty>
          <button
            className="nd-button"
            onClick={() =>
              void execute(async () => {
                await load();
              })
            }
          >
            <RefreshCw size={15} />
            Volver a intentar
          </button>
        </div>
      ) : !data ? (
        <div className="site-studio-loading">
          Abriendo las páginas de Directus…
        </div>
      ) : (
        <div className="site-studio-layout">
          <aside className="site-pages">
            <div
              className="site-languages"
              role="group"
              aria-label="Idioma del sitio"
            >
              {["es", "en"].map((lang) => (
                <button
                  key={lang}
                  className={locale === lang ? "active" : ""}
                  onClick={() => {
                    setLocale(lang);
                    setSelected(
                      data.pages.find(
                        (p) => p.path === (lang === "en" ? "/en/" : "/"),
                      )?.id || selected,
                    );
                    setSection("all");
                  }}
                >
                  {lang === "es" ? "Español" : "English"}
                </button>
              ))}
            </div>
            <label className="site-page-search">
              <Search size={15} />
              <input
                aria-label="Buscar página"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar página…"
              />
            </label>
            <div className="site-pages-list">
              {pages.map((p) => (
                <button
                  key={p.id}
                  className={selected === p.id ? "active" : ""}
                  onClick={() => {
                    setSelected(p.id);
                    setSection("all");
                  }}
                >
                  <Layout size={16} />
                  <span>
                    <strong>
                      {p.path === "/"
                        ? "Inicio"
                        : p.path === "/en/"
                          ? "Home"
                          : p.title.replace(/\s*\|.*$/, "")}
                    </strong>
                    <small>{p.path}</small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
            </div>
            <div className="site-directus-link">
              <Check size={13} />
              <span>Contenido en Directus</span>
              {data.directusUrl && (
                <a
                  href={data.directusUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir Directus"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </aside>
          <section className="site-page-editor">
            {page && (
              <>
                <div className="site-page-toolbar">
                  <div>
                    <strong>{page.path}</strong>
                    <span>
                      {dirty
                        ? `${dirty} cambio(s) sin guardar`
                        : published
                          ? "Versión publicada"
                          : "Borrador guardado · pendiente de publicar"}
                    </span>
                  </div>
                  <a href={page.path || "/"} target="_blank" rel="noreferrer">
                    Ver sitio <ExternalLink size={12} />
                  </a>
                </div>
                <div className="site-page-controls">
                  <div role="tablist" aria-label="Editar página">
                    {[
                      ["visual", "Editor visual"],
                      ["seo", "SEO y publicación"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        className={tab === id ? "active" : ""}
                      >
                        {id === "visual" ? (
                          <Eye size={14} />
                        ) : (
                          <Settings size={14} />
                        )}{" "}
                        {label}
                      </button>
                    ))}
                  </div>
                  {tab === "visual" && (
                    <label>
                      Sección
                      <select
                        aria-label="Sección de la página"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                      >
                        <option value="all">Toda la página</option>
                        {[...new Set(fields.map((f) => f.section))].map(
                          (id) => (
                            <option key={id} value={id}>
                              {sectionNames[id] || id}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                </div>
                {tab === "visual" ? (
                  <div ref={root} className="site-visual-root" />
                ) : (
                  <div className="site-seo-panel">
                    <div className="site-seo-form">
                      <h2>SEO de esta página</h2>
                      <p>
                        El título y la descripción se publican en el HTML del
                        sitio.
                      </p>
                      <label className="nd-field">
                        Título para buscadores
                        <input
                          aria-label="Título SEO"
                          value={seo.title || ""}
                          onChange={(e) => patchSeo({ title: e.target.value })}
                          maxLength={180}
                        />
                        <small>{(seo.title || "").length} / 180</small>
                      </label>
                      <label className="nd-field">
                        Descripción para buscadores
                        <textarea
                          aria-label="Descripción SEO"
                          value={seo.description || ""}
                          onChange={(e) =>
                            patchSeo({ description: e.target.value })
                          }
                          maxLength={500}
                          rows={4}
                        />
                      </label>
                      <label className="site-noindex">
                        <input
                          type="checkbox"
                          checked={!!seo.noindex}
                          onChange={(e) =>
                            patchSeo({ noindex: e.target.checked })
                          }
                        />
                        No mostrar esta página en buscadores
                      </label>
                      <div className="site-search-preview">
                        <small>neurodiversa.mx{page.path}</small>
                        <h3>{seo.title || page.title}</h3>
                        <p>{seo.description}</p>
                      </div>
                    </div>
                    <aside>
                      <h2>Publicación</h2>
                      <p>
                        Guardar conserva el borrador en Directus. Publicar
                        actualiza esta página en el sitio.
                      </p>
                      <p>
                        La navegación y el pie de página son compartidos entre
                        páginas del mismo idioma.
                      </p>
                      <span className="site-live-badge">
                        <Globe size={15} />
                        {data.release
                          ? "El sitio tiene una versión publicada"
                          : "Sin versión publicada"}
                      </span>
                    </aside>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
