import type { MailchimpSetup, NewsletterCampaign } from "./types";
import { monthKey } from "./api";
export const brandSetup: MailchimpSetup = {
  heroImage: "https://neurodiversa.mx/dra-ariadna-mondragon.jpg",
  gallery: [
    "https://neurodiversa.mx/dra-ariadna-mondragon.jpg",
    "https://neurodiversa.mx/cindy-alvarado-mondragon.webp",
  ],
  address: "Cracovia 72, Torre A, Oficina 216 · San Ángel, CDMX",
  phone: "55 7191 9515",
  websiteUrl: "https://neurodiversa.mx",
  reservationUrl: "https://neurodiversa.mx/programas/habilidades-sociales/",
  fromName: "Neuro Diversa",
  fromEmail: "",
  replyTo: "",
  accountLabel: "Neuro Diversa",
  mailchimp: { apiKey: "", serverPrefix: "", audienceId: "" },
};
export const templates = [
  {
    id: "group",
    title: "Un espacio para conectar",
    description: "Presenta el programa de habilidades sociales.",
    tag: "Programa grupal",
  },
  {
    id: "team",
    title: "Dos miradas, un propósito",
    description: "Comparte el enfoque de Ariadna y Cindy.",
    tag: "Nuestro equipo",
  },
  {
    id: "readers",
    title: "Ideas para comprendernos",
    description: "Reúne lecturas y recursos del sitio.",
    tag: "Lecturas",
  },
];
export function newCampaign(
  template = "group",
  month = monthKey(),
): NewsletterCampaign {
  const name = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(
    new Date(`${month}-15T12:00:00`),
  );
  const team = template === "team",
    readers = template === "readers";
  const title = team
    ? "Dos miradas. Un mismo propósito."
    : readers
      ? "Ideas para comprendernos."
      : "Distintas formas de ser. Un espacio para conectar.";
  return {
    id: crypto.randomUUID(),
    kind: "email",
    subject: team
      ? "Conoce al equipo de Neuro Diversa"
      : readers
        ? "Lecturas y novedades de Neuro Diversa"
        : "Conoce nuestro proyecto de habilidades sociales",
    body: team
      ? "Hola {{firstName}},\n\nEn Neuro Diversa reunimos psiquiatría y psicología, con respeto por la historia y la forma de vivir el mundo de cada persona.\n\nLa Dra. Ariadna Mondragón y la Psic. Cindy Alvarado Mondragón ofrecen distintas miradas para acompañarte.\n\nConoce al equipo y sus formas de atención."
      : readers
        ? "Hola {{firstName}},\n\nCompartimos algunas lecturas para comprender mejor antes de consultar y conocer las formas de atención de Neuro Diversa.\n\nLa información es orientativa y no sustituye una valoración profesional individual."
        : "Hola {{firstName}},\n\nEstamos preparando un espacio grupal para jóvenes adultos que desean explorar sus habilidades sociales desde el aprendizaje compartido y el respeto a distintas formas de vincularse.\n\nPuedes solicitar información al equipo para conocer los detalles y el proceso de participación. Las fechas y condiciones se confirmarán antes de la inscripción.\n\nEl equipo de Neuro Diversa.",
    headline: title,
    preheader:
      "Novedades, lecturas y experiencias compartidas del equipo de Neuro Diversa.",
    eyebrow: "NEURO DIVERSA · UN ESPACIO PARA COMPRENDERTE",
    heroImage: brandSetup.heroImage,
    cta: team
      ? "Conocer al equipo"
      : readers
        ? "Explorar el blog"
        : "Conocer el programa",
    ctaUrl: team
      ? "https://neurodiversa.mx/#equipo"
      : readers
        ? "https://neurodiversa.mx/blog/"
        : "https://neurodiversa.mx/programas/habilidades-sociales/",
    highlights: [
      "Atención individual",
      "Proyecto grupal",
      "Lecturas y recursos",
    ],
    events: [
      {
        id: crypto.randomUUID(),
        category: team ? "Nuestro equipo" : "Programa grupal",
        title: team
          ? "Psiquiatría y psicología"
          : "Habilidades sociales en grupo",
        date: "Información y detalles con el equipo",
        venue: "San Ángel, Ciudad de México",
        description: team
          ? "Conoce la formación y el enfoque de nuestras profesionales."
          : "Un proyecto para jóvenes adultos de 18 a 35 años. Participación y detalles por confirmar con el equipo.",
        url: team
          ? "https://neurodiversa.mx/#equipo"
          : "https://neurodiversa.mx/programas/habilidades-sociales/",
        sourceLabel: "Neuro Diversa",
        imageUrl: "",
        month: name,
        sortDate: "",
      },
    ],
    month: name.charAt(0).toUpperCase() + name.slice(1),
    monthKey: month,
    year: Number(month.slice(0, 4)),
    status: "DRAFT",
    sendWindow: "Por definir",
    segment: "Suscriptores con autorización vigente",
    goal: "Compartir información del equipo y recibir solicitudes de información.",
    language: "es",
    channelIds: [],
    mediaUrl: "",
    mode: "draft",
    dueAt: "",
  };
}
export function normalizeCampaign(
  c: Partial<NewsletterCampaign>,
): NewsletterCampaign {
  const base = newCampaign("group", c.monthKey || monthKey());
  return {
    ...base,
    ...c,
    highlights: c.highlights || base.highlights,
    events: c.events || [],
    bodyHtml: c.bodyHtml || "",
    status: c.status || "DRAFT",
  };
}
