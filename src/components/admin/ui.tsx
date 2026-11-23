import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X, ImagePlus, Upload, Check, Search } from "lucide-react";
import { api } from "./api";
import type { Workspace } from "./types";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`nd-dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">NEURO DIVERSA · WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Empty({
  icon: Icon = Search,
  title,
  children,
}: {
  icon?: typeof Search;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="nd-empty">
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  const label: Record<string, string> = {
    new: "Por contactar",
    contacted: "Contactado",
    enrolled: "Inscrito",
    closed: "Cerrado",
    ai: "Olivia AI",
    manual: "Equipo",
    queued: "En cola",
    running: "Procesando",
    accepted: "Aceptado",
    unconfirmed: "Revisar",
    excluded: "Excluido",
    draft: "Borrador",
    scheduled: "Programado",
    sent: "Publicado",
    DRAFT: "Borrador",
    READY: "En revisión",
  };
  return (
    <span className={`nd-badge ${value.toLowerCase()}`}>
      {label[value] || value}
    </span>
  );
}
export function ImagePicker({
  value,
  onChange,
  workspace,
  refresh,
}: {
  value: string;
  onChange: (url: string) => void;
  workspace: Workspace;
  refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 2000000) {
      setError("Elige una imagen de hasta 2 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = await api<{ url: string }>("admin/media", {
        name: file.name,
        base64,
      });
      await refresh();
      onChange(image.url);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const images = [
    ...workspace.media,
    ...[
      {
        id: "ariadna",
        name: "Dra. Ariadna Mondragón",
        url: "https://neurodiversa.mx/dra-ariadna-mondragon.jpg",
      },
      {
        id: "cindy",
        name: "Psic. Cindy Alvarado Mondragón",
        url: "https://neurodiversa.mx/cindy-alvarado-mondragon.webp",
      },
    ],
  ];
  return (
    <>
      <button
        type="button"
        className="image-picker"
        onClick={() => setOpen(true)}
      >
        {value ? (
          <img src={value} alt="Imagen seleccionada" />
        ) : (
          <ImagePlus size={24} />
        )}
        <span>
          <strong>{value ? "Cambiar imagen" : "Elegir imagen"}</strong>
          <small>Biblioteca o archivo</small>
        </span>
      </button>
      {open && (
        <Modal
          title="Biblioteca de imágenes"
          onClose={() => setOpen(false)}
          wide
        >
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={25} />
            <strong>
              {busy
                ? "Preparando imagen…"
                : "Arrastra una imagen o selecciona un archivo"}
            </strong>
            <span>JPG, PNG, WebP o AVIF · Hasta 2 MB</span>
            <input
              aria-label="Subir imagen"
              disabled={busy}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="media-grid">
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => {
                  onChange(image.url);
                  setOpen(false);
                }}
                className={value === image.url ? "selected" : ""}
              >
                <img src={image.url} alt={image.name} loading="lazy" />
                <span>
                  {image.name}
                  {value === image.url && <Check size={16} />}
                </span>
              </button>
            ))}
          </div>
          <label className="nd-field">
            URL pública HTTPS
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </Modal>
      )}
    </>
  );
}
