export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const value = await response
    .json()
    .catch(() => ({ error: "No se pudo conectar con el espacio." }));
  if (!response.ok) {
    if (response.status === 401 && path.startsWith("admin/"))
      window.dispatchEvent(new Event("neurodiversa:session-expired"));
    throw new ApiError(
      value.error || value.message || "No se pudo completar la acción.",
      response.status,
    );
  }
  return value as T;
}
export const monthKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
};
export const formatDate = (value: string) =>
  value
    ? new Date(value).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
export const statusLabel: Record<string, string> = {
  new: "Por contactar",
  contacted: "Contactado",
  enrolled: "Inscrito",
  closed: "Cerrado",
  ai: "Olivia AI",
  manual: "Equipo",
  group: "Grupo de habilidades sociales",
  psychology: "Psicología",
  psychiatry: "Psiquiatría",
  general: "Información general",
  queued: "En cola",
  running: "Procesando",
  accepted: "Aceptado",
  unconfirmed: "Revisar envío",
  excluded: "Excluido",
  draft: "Borrador",
  scheduled: "Programado",
  sent: "Publicado",
  DRAFT: "Borrador",
  READY: "Listo para revisión",
};
