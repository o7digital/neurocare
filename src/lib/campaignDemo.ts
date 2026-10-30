import type { NewsletterCampaign } from "./crmMailing";
import { keys, readDemo } from "../scripts/editorialDemo";
export type MailingRecord = {
  id: string;
  subject: string;
  body: string;
  audience: string[];
  status: "draft" | "test" | "simulated";
  updated: string;
};
export const demoAudience = [
  {
    id: "demo-ana",
    firstName: "Ana",
    name: "Ana · Contacto de ejemplo",
    email: "ana@example.test",
    segment: "group",
    consent: true,
  },
  {
    id: "demo-luis",
    firstName: "Luis",
    name: "Luis · Contacto de ejemplo",
    email: "luis@example.test",
    segment: "group",
    consent: true,
  },
  {
    id: "demo-maria",
    firstName: "María",
    name: "María · Contacto de ejemplo",
    email: "maria@example.test",
    segment: "readers",
    consent: true,
  },
  {
    id: "demo-alex",
    firstName: "Alex",
    name: "Alex · Contacto de ejemplo",
    email: "alex@example.test",
    segment: "readers",
    consent: false,
  },
];
export function newCampaign(template = "group"): NewsletterCampaign {
  const blank = template === "blank";
  const readers = template === "readers";
  return {
    id: crypto.randomUUID(),
    month: blank
      ? "Mi nueva newsletter"
      : readers
        ? "Lecturas para comprendernos"
        : "Un espacio para conectar",
    subject: blank
      ? "Tu asunto de correo"
      : readers
        ? "Lecturas y novedades de Neuro Diversa"
        : "Conoce nuestro proyecto de habilidades sociales",
    preheader: blank
      ? "Texto breve de vista previa."
      : "Novedades del equipo, lecturas y experiencias compartidas.",
    headline: blank
      ? "Tu gran título"
      : readers
        ? "Ideas para comprendernos."
        : "Distintas formas de ser. Un espacio para conectar.",
    eyebrow: "NEURO DIVERSA · BOLETÍN",
    heroImage: "",
    body: blank
      ? "Hola {{firstName}},\n\nEscribe aquí tu mensaje.\n\nEl equipo de Neuro Diversa."
      : "Hola {{firstName}},\n\nQueremos compartir contigo las novedades de Neuro Diversa: un espacio que reúne psiquiatría y psicología, con respeto por distintas formas de vivir el mundo.\n\nEstamos preparando un proyecto grupal de habilidades sociales para jóvenes adultos. Las fechas, facilitadoras y condiciones de participación se confirmarán con el equipo.\n\nEste contenido es ilustrativo y sirve para explorar la administración.\n\nCon cariño,\nEl equipo de Neuro Diversa.",
    cta: readers ? "Explorar el blog" : "Conocer el programa",
    ctaUrl: readers
      ? "https://neurodiversa.mx/blog/"
      : "https://neurodiversa.mx/programas/habilidades-sociales/",
    highlights: [
      "Atención individual",
      "Proyecto grupal",
      "Lecturas y recursos",
    ],
    events: [],
    status: "DRAFT",
    updated: new Date().toISOString(),
  };
}
export function getCampaigns(): NewsletterCampaign[] {
  const raw = readDemo<unknown>(keys.newsletters, []);
  return Array.isArray(raw)
    ? raw.filter(
        (p): p is NewsletterCampaign =>
          p &&
          typeof p.id === "string" &&
          [
            "month",
            "subject",
            "preheader",
            "headline",
            "eyebrow",
            "heroImage",
            "body",
            "cta",
            "ctaUrl",
            "updated",
          ].every((k) => typeof p[k] === "string") &&
          Array.isArray(p.highlights) &&
          p.highlights.every((s: unknown) => typeof s === "string") &&
          Array.isArray(p.events) &&
          p.events.every(
            (e: unknown) =>
              e &&
              typeof e === "object" &&
              [
                "id",
                "category",
                "title",
                "date",
                "venue",
                "description",
                "url",
                "sourceLabel",
              ].every(
                (k) => typeof (e as Record<string, unknown>)[k] === "string",
              ) &&
              (!("imageUrl" in e) || typeof e.imageUrl === "string"),
          ) &&
          ["DRAFT", "SAVED"].includes(p.status),
      )
    : [];
}
export function getMailings(): MailingRecord[] {
  const raw = readDemo<unknown>(keys.mailing, []);
  return Array.isArray(raw)
    ? raw.filter(
        (p): p is MailingRecord =>
          p &&
          ["id", "subject", "body", "updated"].every(
            (k) => typeof p[k] === "string",
          ) &&
          Array.isArray(p.audience) &&
          p.audience.every((a: unknown) => typeof a === "string") &&
          ["draft", "test", "simulated"].includes(p.status),
      )
    : [];
}
