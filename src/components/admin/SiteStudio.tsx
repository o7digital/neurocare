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
import { api, ApiError } from "./api";
import { Empty } from "./ui";
import { mountVisualEditor, visualEditorMarkup } from "./site/visual-editor.js";
import PageBlocks, { flattenBlocks, updateBlock } from "./site/PageBlocks";
import type {
  SiteBlock,
  SiteData,
  SiteDraft,
  SiteField,
  SitePage,
} from "./site/types";
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
    [editVersion, setEditVersion] = useState(0),
    [syncError, setSyncError] = useState(""),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    pending = useRef<
      Record<
        string,
        {
          id: string;
          revision: number;
          values: Record<string, string>;
          baseValues?: Record<string, string>;
          seo?: SiteDraft["seo"];
          blocks?: SiteDraft["blocks"];
          baseBlocks?: SiteDraft["blocks"];
        }
      >
    >({}),
    dataRef = useRef(data),
    busyRef = useRef(busy),
    savingRef = useRef<Promise<void> | null>(null),
    visualRef = useRef<ReturnType<typeof mountVisualEditor> | null>(null),
    loadSequence = useRef(0),
    prefs = useRef({
      device: "auto",
      locale: "es",
      path: "/",
    }),
    selectedRef = useRef(selected);
  dataRef.current = data;
  busyRef.current = busy;
  selectedRef.current = selected;
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const value = await api<SiteData>("admin/site/pages");
    if (sequence !== loadSequence.current && dataRef.current)
      return dataRef.current;
    setData(value);
    dataRef.current = value;
    visualRef.current?.refresh();
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
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !savingRef.current)
        void load().catch((e) => setSyncError(e.message));
    };
    const interval = window.setInterval(refresh, 4000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
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
    if (id.startsWith("block:")) {
      const current = dataRef.current?.pages.find(
        (p) => p.id === selectedRef.current,
      );
      return (
        flattenBlocks(
          pending.current[current?.id || ""]?.blocks ||
            current?.draft.blocks ||
            [],
        ).find((b) => b.id === id.slice(6))?.html || ""
      );
    }
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
      baseValues: {},
    };
    pending.current[field.document].baseValues ??= {};
    pending.current[field.document].baseValues![field.id] ??=
      doc.draft?.values?.[field.id] ?? field.source;
    pending.current[field.document].values[field.id] = value;
    setEditVersion((version) => version + 1);
    setSyncError("");
    setDirty(
      Object.values(pending.current).reduce(
        (n, p) =>
          n +
          Object.keys(p.values).length +
          (p.seo ? 1 : 0) +
          (p.blocks ? 1 : 0),
        0,
      ),
    );
  };
  const patchBlocks = (blocks: SiteBlock[]) => {
    const current = dataRef.current?.pages.find(
      (p) => p.id === selectedRef.current,
    );
    if (!current) return;
    pending.current[current.id] ??= {
      id: current.id,
      revision: current.revision,
      values: {},
    };
    const edit = pending.current[current.id];
    edit.baseBlocks ??= structuredClone(current.draft.blocks || []);
    edit.blocks = blocks;
    setSyncError("");
    setEditVersion((version) => version + 1);
    setDirty(
      Object.values(pending.current).reduce(
        (n, p) =>
          n +
          Object.keys(p.values).length +
          (p.seo ? 1 : 0) +
          (p.blocks ? 1 : 0),
        0,
      ),
    );
  };
  const uploadMedia = async (file: File): Promise<string> => {
    if (!file.type.startsWith("video/")) {
      const image = await api<{ id: string }>("admin/site/upload", {
        name: file.name,
        base64: await normalizedPhoto(file),
      });
      return `cms:${image.id}`;
    }
    if (
      !["video/mp4", "video/webm"].includes(file.type) ||
      file.size > 50 * 1024 * 1024
    )
      throw new Error("Usa un vídeo MP4 o WebM de hasta 50 MB.");
    notify("Subiendo vídeo… Mantén abierto el editor.");
    const upload = await api<{ id: string }>("admin/site/video-upload", {
      name: file.name,
      mime: file.type,
      size: file.size,
    });
    for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
      const bytes = new Uint8Array(
        await file.slice(offset, offset + 1024 * 1024).arrayBuffer(),
      );
      let binary = "";
      for (let start = 0; start < bytes.length; start += 8192)
        binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
      await api("admin/site/video-upload-chunk", {
        id: upload.id,
        offset,
        base64: btoa(binary),
      });
    }
    const result = await api<{ id: string }>("admin/site/video-upload-finish", {
      id: upload.id,
    });
    notify("Vídeo importado. Guarda y publica cuando esté listo.");
    return `cms:${result.id}`;
  };
  const save = async (automatic = false): Promise<void> => {
    if (savingRef.current) {
      await savingRef.current;
      if (Object.keys(pending.current).length) await save(automatic);
      return;
    }
    const documents = structuredClone(Object.values(pending.current));
    if (!documents.length) return;
    busyRef.current = true;
    setBusy(true);
    const task = (async () => {
      try {
        await api("admin/site/save", { documents });
        for (const saved of documents) {
          const current = pending.current[saved.id];
          if (!current) continue;
          for (const [id, value] of Object.entries(saved.values)) {
            if (current.values[id] === value) {
              delete current.values[id];
              delete current.baseValues?.[id];
            } else {
              current.baseValues ??= {};
              current.baseValues[id] = value;
            }
          }
          if (
            saved.seo &&
            JSON.stringify(current.seo) === JSON.stringify(saved.seo)
          )
            delete current.seo;
          if (
            saved.blocks &&
            JSON.stringify(current.blocks) === JSON.stringify(saved.blocks)
          ) {
            delete current.blocks;
            delete current.baseBlocks;
          } else if (saved.blocks) current.baseBlocks = saved.blocks;
          if (
            !Object.keys(current.values).length &&
            !current.seo &&
            !current.blocks
          )
            delete pending.current[saved.id];
        }
        const latest = await load();
        for (const edit of Object.values(pending.current))
          edit.revision =
            latest.pages.find((p) => p.id === edit.id)?.revision ??
            edit.revision;
        setDirty(
          Object.values(pending.current).reduce(
            (n, p) =>
              n +
              Object.keys(p.values).length +
              (p.seo ? 1 : 0) +
              (p.blocks ? 1 : 0),
            0,
          ),
        );
        setSyncError("");
        if (!automatic) notify("Cambios guardados en Directus.");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setConflict(true);
          await load().catch(() => {});
        }
        setSyncError((e as Error).message);
        throw e;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    })();
    savingRef.current = task;
    try {
      await task;
    } finally {
      savingRef.current = null;
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || syncError || busy || conflict) return;
    const timer = window.setTimeout(() => {
      void saveRef.current(true).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, busy, syncError, editVersion, conflict]);
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
      rows: [
        ...visibleFields
          .filter((f) => f.kind !== "image")
          .map((f) => ({
            label: f.label,
            target: { key: f.id },
            rich: f.kind === "text",
          })),
        ...flattenBlocks(page.draft.blocks || [])
          .filter((b) => b.type === "text")
          .map((b) => ({
            label: "Bloque de texto",
            target: { key: `block:${b.id}` },
            rich: true,
          })),
      ],
      photos: [
        ...visibleFields
          .filter((f) => f.kind === "image")
          .map((f) => ({ collection: f.document, id: f.key, label: f.label })),
        ...flattenBlocks(page.draft.blocks || [])
          .filter((b) => b.type === "image")
          .map((b) => ({
            collection: "block",
            id: b.id,
            label: b.alt || "Fotografía del bloque",
          })),
      ],
      valueOf: (t) => valueOf(t.key),
      photoOf: (row) => {
        const current = dataRef.current?.pages.find(
          (p) => p.id === selectedRef.current,
        );
        const value =
          row.collection === "block"
            ? flattenBlocks(
                pending.current[current?.id || ""]?.blocks ||
                  current?.draft.blocks ||
                  [],
              ).find((b) => b.id === row.id)?.src || ""
            : valueOf(`${row.collection}:${row.id}`);
        return value.startsWith("cms:")
          ? `/api/admin/site/asset/${value.slice(4)}`
          : value;
      },
      onText: (target, value) => {
        if (target.key.startsWith("block:")) {
          const current = dataRef.current?.pages.find(
            (p) => p.id === selectedRef.current,
          );
          if (current)
            patchBlocks(
              updateBlock(
                pending.current[current.id]?.blocks ||
                  current.draft.blocks ||
                  [],
                target.key.slice(6),
                { html: value },
              ),
            );
          return;
        }
        const field = fieldMap.current.get(target.key);
        if (field) mark(field, value);
      },
      onPhoto: async (row, file) => {
        if (row.collection === "block") {
          const src = await uploadMedia(file);
          const current = dataRef.current?.pages.find(
            (p) => p.id === selectedRef.current,
          );
          if (current)
            patchBlocks(
              updateBlock(
                pending.current[current.id]?.blocks ||
                  current.draft.blocks ||
                  [],
                row.id,
                { src },
              ),
            );
          return;
        }
        const field = fieldMap.current.get(`${row.collection}:${row.id}`);
        if (!field) return;
        const base64 = await normalizedPhoto(file),
          image = await api<{ id: string }>("admin/site/upload", {
            name: file.name,
            base64,
          });
        mark(field, `cms:${image.id}`);
      },
      onSave: () => save(),
      onConvertText: (target) => {
        const field = fieldMap.current.get(target.key);
        const current = dataRef.current?.pages.find(
          (p) => p.id === selectedRef.current,
        );
        if (
          !field ||
          field.runtime ||
          !current ||
          field.document !== current.id
        )
          return;
        const html = valueOf(field.id);
        patchBlocks([
          ...(pending.current[current.id]?.blocks ||
            current.draft.blocks ||
            []),
          {
            id: crypto.randomUUID(),
            type: "text",
            html,
            size: 18,
            font: "site",
            anchor: `text:${field.id}`,
            position: "after",
          },
        ]);
        mark(field, "");
        setTab("blocks");
      },
      prefs: prefs.current,
      dirtyCount: () =>
        Object.values(pending.current).reduce(
          (n, p) =>
            n +
            Object.keys(p.values).length +
            (p.seo ? 1 : 0) +
            (p.blocks ? 1 : 0),
          0,
        ),
      busy: () => busyRef.current,
    });
    visualRef.current = handle;
    return () => {
      handle.destroy();
      visualRef.current = null;
    };
  }, [
    selected,
    section,
    tab,
    !!data,
    JSON.stringify(page?.draft.blocks || []),
  ]);
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
    setEditVersion((version) => version + 1);
    setDirty(
      Object.values(pending.current).reduce(
        (n, p) =>
          n +
          Object.keys(p.values).length +
          (p.seo ? 1 : 0) +
          (p.blocks ? 1 : 0),
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
            onClick={() => void execute(() => save())}
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
      <div className="site-sync-status" role="status">
        {syncError
          ? `No se pudo guardar: ${syncError} Tus cambios siguen aquí.`
          : busy
            ? "Guardando el borrador compartido…"
            : dirty
              ? "Cambios pendientes de guardar…"
              : "Borrador compartido · guardado automático · sincronizado con el equipo"}
      </div>
      {conflict && (
        <div className="site-conflict" role="alert">
          <h2>Este contenido cambió en otra sesión</h2>
          <p>
            Tus cambios siguen aquí. Compara las dos versiones antes de elegir
            cuál conservar.
          </p>
          {Object.values(pending.current).map((edit) => {
            const shared = data?.pages.find((p) => p.id === edit.id);
            return (
              <div key={edit.id}>
                <strong>{shared?.path || shared?.title}</strong>
                <div className="site-conflict-versions">
                  <div>
                    <h3>Versión del equipo</h3>
                    <pre>
                      {Object.keys(edit.values)
                        .map(
                          (id) =>
                            shared?.draft.values[id] ??
                            shared?.catalog.find((f) => f.id === id)?.source ??
                            "",
                        )
                        .join("\n\n")}
                      {edit.blocks
                        ? JSON.stringify(shared?.draft.blocks || [], null, 2)
                        : ""}
                    </pre>
                  </div>
                  <div>
                    <h3>Tus cambios</h3>
                    <pre>
                      {Object.values(edit.values).join("\n\n")}
                      {edit.blocks ? JSON.stringify(edit.blocks, null, 2) : ""}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="button-row">
            <button
              className="nd-button"
              onClick={() => {
                pending.current = {};
                setDirty(0);
                setConflict(false);
                setSyncError("");
                visualRef.current?.refresh();
              }}
            >
              Usar la versión del equipo
            </button>
            <button
              className="nd-button primary"
              onClick={() => {
                for (const edit of Object.values(pending.current)) {
                  const shared = dataRef.current?.pages.find(
                    (p) => p.id === edit.id,
                  );
                  if (!shared) continue;
                  edit.revision = shared.revision;
                  edit.baseValues = Object.fromEntries(
                    Object.keys(edit.values).map((id) => [
                      id,
                      shared.draft.values[id] ??
                        shared.catalog.find((f) => f.id === id)?.source ??
                        "",
                    ]),
                  );
                  if (edit.blocks)
                    edit.baseBlocks = structuredClone(
                      shared.draft.blocks || [],
                    );
                }
                setConflict(false);
                setSyncError("");
                void execute(() => save());
              }}
            >
              Guardar mi versión sobre la compartida
            </button>
          </div>
        </div>
      )}
      {syncError && !conflict && (
        <button
          className="nd-button"
          onClick={() => {
            setSyncError("");
            void execute(() => save());
          }}
        >
          Volver a guardar
        </button>
      )}
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
                      ["blocks", "Bloques y columnas"],
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
                ) : tab === "blocks" ? (
                  <PageBlocks
                    blocks={
                      pending.current[page.id]?.blocks ||
                      page.draft.blocks ||
                      []
                    }
                    fields={fields}
                    change={patchBlocks}
                    upload={uploadMedia}
                    notify={notify}
                  />
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
