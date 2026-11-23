import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const guide = JSON.parse(
  await readFile(new URL("src/content/admin-guide.es.json", root), "utf8"),
);
const lines = [
  "<!-- Generado desde src/content/admin-guide.es.json. Para actualizarlo: npm run docs:guide -->",
  "",
  `# ${guide.title} · Neuro Diversa`,
  "",
  guide.description,
  "",
  "Acceso al panel: https://neurodiversa.mx/admin/#guide",
  "",
];
for (const section of guide.sections) {
  lines.push(
    `## ${section.title}`,
    "",
    section.summary,
    "",
    ...section.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `> ${section.note}`,
    "",
    `[${section.action}](https://neurodiversa.mx/admin/#${section.panel})`,
    "",
  );
}
lines.push("## Dudas frecuentes", "");
for (const faq of guide.faqs)
  lines.push(`### ${faq.question}`, "", faq.answer, "");
await mkdir(new URL("docs/", root), { recursive: true });
await writeFile(new URL("docs/user-guide.es.md", root), lines.join("\n"));
console.log("Guía de uso: fuente y documento en español sincronizados.");
