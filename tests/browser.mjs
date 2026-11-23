// End-to-end Firefox QA against the isolated fixture; never use against production.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { firefox } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = createRequire(
  new URL("../backend/package.json", import.meta.url),
)("sharp");
const browser = await firefox.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1512, height: 1020 },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = "http://127.0.0.1:4328",
  shots = "/tmp/neurodiversa-qa";
mkdirSync(shots, { recursive: true });
await context.route(
  "https://neurodiversa.mx/api/public/media/**",
  async (route) =>
    route.fulfill({
      response: await context.request.get(
        base + new URL(route.request().url()).pathname,
      ),
    }),
);
try {
  await page.goto(base + "/programas/habilidades-sociales/");
  await page
    .getByRole("button", { name: "Me interesa el grupo", exact: true })
    .click();
  const widget = page.locator("#neurodiversa-olivia");
  for (const [name, value] of Object.entries({
    firstName: "Paciente",
    lastName: "Prueba QA",
    email: "patient-qa@example.test",
    phone: "+52 5550000000",
  }))
    await widget.locator(`input[name=${name}]`).fill(value);
  await widget
    .locator("textarea[name=message]")
    .fill("Quisiera conocer los horarios del grupo.");
  await widget.locator("input[name=consent]").check();
  await widget
    .getByRole("button", { name: "Enviar solicitud", exact: true })
    .click();
  await widget.getByText("Tu solicitud ya está", { exact: false }).waitFor();
  await widget.locator("input[name=chatConsent]").check();
  await widget
    .locator(".olivia-composer input[name=message]")
    .fill("¿Para qué edades es el grupo?");
  await widget
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await widget
    .getByText("El grupo de habilidades sociales es para jóvenes adultos", {
      exact: false,
    })
    .waitFor();
  await page.screenshot({ path: shots + "/widget-desktop.png" });
  const admin = await context.newPage();
  admin.on("pageerror", (error) => errors.push(error.message));
  admin.on("dialog", (dialog) => dialog.accept());
  await admin.goto(base + "/admin/");
  await admin.locator("input[name=email]").fill("reviewer@example.test");
  await admin
    .locator("input[name=password]")
    .fill("Neurodiversa-QA-only-2026!");
  await admin
    .getByRole("button", { name: "Entrar al workspace", exact: true })
    .click();
  await admin
    .getByRole("heading", { name: "Mailing & newsletters", exact: true })
    .waitFor();
  const editor = admin.locator(".newsletter-editor");
  await editor.getByLabel(/^Asunto/).fill("Novedades Neuro Diversa · QA");
  await editor
    .getByLabel("Título principal", { exact: true })
    .fill("Un espacio para conectar");
  await admin
    .getByRole("heading", { name: "Un espacio para conectar", exact: true })
    .waitFor();
  await admin.getByRole("button", { name: "Guardar", exact: true }).click();
  await admin.getByText("Campaña guardada.", { exact: true }).waitFor();
  await admin.screenshot({ path: shots + "/studio-desktop.png" });
  await admin
    .getByRole("button", { name: "Editar documento", exact: true })
    .click();
  await admin.locator("dialog .tiptap").waitFor();
  await admin
    .locator("dialog .tiptap")
    .fill("Hola {{firstName}}, este documento se edita y se conserva.");
  await admin
    .locator("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await admin.getByText("Documento guardado.", { exact: true }).waitFor();
  await admin.screenshot({ path: shots + "/document-desktop.png" });
  await admin.getByRole("button", { name: "← Volver", exact: true }).click();
  await admin.getByRole("tab", { name: "Diseño", exact: true }).click();
  await editor.getByRole("button", { name: /Cambiar imagen/ }).click();
  const png = await sharp({
    create: { width: 60, height: 60, channels: 3, background: "#87424d" },
  })
    .png()
    .toBuffer();
  await admin.getByLabel("Subir imagen", { exact: true }).setInputFiles({
    name: "qa-biblioteca.png",
    mimeType: "image/png",
    buffer: png,
  });
  await admin.locator("dialog").waitFor({ state: "hidden" });
  await admin.getByRole("tab", { name: "Actividades", exact: true }).click();
  await admin
    .getByRole("button", { name: "Guardar en catálogo", exact: true })
    .click();
  await admin
    .getByText("Actividad guardada en el catálogo.", { exact: true })
    .waitFor();
  await admin.getByRole("button", { name: "Guardar", exact: true }).click();
  await admin.getByText("Campaña guardada.", { exact: true }).waitFor();
  await admin
    .getByRole("button", { name: "Publicar agenda", exact: true })
    .click();
  await admin
    .getByText("Agenda publicada en el sitio.", { exact: true })
    .waitFor();
  const workspace = await (
    await admin.request.get(base + "/api/admin/workspace")
  ).json();
  assert.equal(workspace.catalog.length, 1);
  assert.equal(workspace.media.length, 1);
  assert.ok(workspace.campaigns[0].bodyHtml.includes("documento se edita"));
  const agenda = await context.newPage();
  agenda.on("pageerror", (error) => errors.push(error.message));
  await agenda.goto(base + "/agenda/?id=" + workspace.publications[0].id);
  await agenda
    .getByRole("heading", { name: "Un espacio para conectar", exact: true })
    .waitFor();
  await admin
    .getByRole("button", { name: "Preparar en Buffer Studio", exact: true })
    .click();
  await admin
    .getByRole("heading", { name: "Buffer Studio", exact: true })
    .waitFor();
  await admin
    .getByLabel("Texto de la publicación", { exact: false })
    .fill("Texto de prueba aislado.");
  await admin
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await admin.getByText("Publicación guardada.", { exact: true }).waitFor();
  const nav = admin.getByRole("navigation", { name: "Administración" });
  await nav
    .getByRole("button", { name: "Conexiones y accesos", exact: true })
    .click();
  const bufferForm = admin.locator("form").filter({
    has: admin.getByRole("heading", { name: "Buffer", exact: true }),
  });
  await bufferForm
    .locator("input[name=apiKey]")
    .fill("qa-buffer-no-real-account");
  await bufferForm.locator("input[name=organizationId]").fill("qa");
  await bufferForm
    .getByRole("button", { name: "Guardar Buffer", exact: true })
    .click();
  await admin.getByText("Conexión guardada.", { exact: true }).waitFor();
  await nav.getByRole("button", { name: "Buffer Studio", exact: true }).click();
  await admin.locator(".channel-selector input[type=checkbox]").check();
  await admin
    .getByRole("button", { name: "Crear borrador en Buffer", exact: true })
    .click();
  await admin
    .getByText("Publicación registrada para Buffer.", { exact: false })
    .waitFor();
  await admin
    .getByRole("button", { name: "Actualizar estados Buffer", exact: true })
    .click();
  await admin
    .getByText("Estados Buffer actualizados.", { exact: true })
    .waitFor();
  await admin.screenshot({ path: shots + "/buffer-desktop.png" });
  await nav
    .getByRole("button", { name: "Inbox pacientes", exact: true })
    .click();
  await admin.getByRole("button", { name: /Paciente Prueba QA/ }).click();
  await admin
    .getByLabel("Nota privada", { exact: true })
    .fill("Contactar para confirmar horarios.");
  await admin.getByLabel(/^Seguimiento/).selectOption("contacted");
  await admin
    .getByRole("button", { name: "Guardar seguimiento", exact: true })
    .click();
  await admin.getByText("Seguimiento guardado.", { exact: true }).waitFor();
  await admin
    .getByLabel("Responder al paciente", { exact: true })
    .fill("Hola, el equipo revisará los horarios contigo.");
  await admin
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();
  await admin
    .locator(".message-bubble.operator")
    .getByText("Hola, el equipo revisará los horarios contigo.", {
      exact: true,
    })
    .waitFor();
  await admin.screenshot({ path: shots + "/inbox-desktop.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir Olivia AI", exact: true })
    .click();
  await page
    .getByText("Hola, el equipo revisará los horarios contigo.", {
      exact: true,
    })
    .waitFor();
  await nav
    .getByRole("button", { name: "Artículos del sitio", exact: true })
    .click();
  await admin
    .getByLabel("Título", { exact: true })
    .fill("Conectar a nuestro ritmo · QA");
  await admin
    .getByLabel("Contenido", { exact: true })
    .fill("Una publicación compartida desde el backend de Neuro Diversa.");
  await admin.getByLabel(/^Estado/).selectOption("published");
  await admin
    .getByRole("button", { name: "Guardar artículo", exact: true })
    .click();
  await admin
    .getByText("Contenido guardado en el sitio.", { exact: true })
    .waitFor();
  const blog = await context.newPage();
  await blog.goto(base + "/blog/");
  await blog
    .getByRole("heading", {
      name: "Conectar a nuestro ritmo · QA",
      exact: true,
    })
    .waitFor();
  await nav
    .getByRole("button", { name: "Programa grupal", exact: true })
    .click();
  await admin
    .getByLabel("Inicio propuesto", { exact: true })
    .fill("Febrero 2027 · QA");
  await admin
    .getByRole("button", { name: "Guardar en el sitio", exact: true })
    .click();
  await admin
    .getByText("Contenido guardado en el sitio.", { exact: true })
    .waitFor();
  await blog.goto(base + "/programas/habilidades-sociales/");
  await blog.getByText("Febrero 2027 · QA", { exact: true }).waitFor();
  await nav
    .getByRole("button", { name: "Mailing & newsletters", exact: true })
    .click();
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.screenshot({
    path: shots + "/studio-mobile.png",
    animations: "disabled",
  });
  assert.ok(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Studio mobile overflow",
  );
  await admin.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await nav
    .getByRole("button", { name: "Inbox pacientes", exact: true })
    .click();
  await admin.getByRole("button", { name: /Paciente Prueba QA/ }).click();
  await admin.screenshot({
    path: shots + "/inbox-mobile.png",
    animations: "disabled",
  });
  assert.ok(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Inbox mobile overflow",
  );
  await page.waitForFunction(
    () =>
      !document
        .querySelector("#neurodiversa-olivia")
        ?.classList.contains("olivia-online"),
    {},
    { timeout: 50000 },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: shots + "/widget-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Public mobile overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Firefox QA passed: live newsletter preview, document editor, image upload, catalog, public snapshot, social draft, Buffer queue/status, patient inbox/operator reply, public article/program, desktop/mobile, Olivia idle indicator.",
  );
} catch (error) {
  for (const [index, p] of context.pages().entries())
    await p
      .screenshot({ path: `${shots}/failure-${index}.png` })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
