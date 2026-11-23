// Firefox: actual page → draft → Directus adapter → publication → public HTML.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const { firefox } = await import(process.env.PLAYWRIGHT_MODULE || "playwright"),
  sharp = createRequire(new URL("../backend/package.json", import.meta.url))(
    "sharp",
  );
const browser = await firefox.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1512, height: 1020 },
  }),
  page = await context.newPage(),
  base = "http://127.0.0.1:4328",
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("/tmp/neurodiversa-qa", { recursive: true });
try {
  await page.goto(base + "/admin/");
  await page.locator("input[name=email]").fill("reviewer@example.test");
  await page.locator("input[name=password]").fill("Neurodiversa-QA-only-2026!");
  await page
    .getByRole("button", { name: "Entrar al workspace", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Tu sitio y tu equipo, en un mismo lugar." })
    .waitFor();
  await page.getByRole("button", { name: /^Editar el sitio/ }).click();
  await page
    .getByRole("heading", { name: "Estudio del sitio", exact: true })
    .waitFor();
  const frame = page.frameLocator(
      'iframe[title="Página de Neuro Diversa · Editor visual"]',
    ),
    title = frame.locator("h1 [data-studio-editable]").first();
  await title.waitFor();
  const original = await title.textContent();
  assert(original.trim());
  assert.equal(
    await page.locator("iframe").getAttribute("sandbox"),
    "allow-same-origin",
  );
  assert.equal(await frame.locator("script").count(), 0);
  await title.fill("Conexiones de prueba QA");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .first()
    .click();
  await page
    .getByText("Cambios guardados en Directus.", { exact: true })
    .waitFor();
  assert(
    !(await (await context.request.get(base + "/")).text()).includes(
      "Conexiones de prueba QA",
    ),
  );
  await page.reload();
  await frame.locator("h1 [data-studio-editable]").first().waitFor();
  assert.equal(
    await frame.locator("h1 [data-studio-editable]").first().textContent(),
    "Conexiones de prueba QA",
  );
  await page.getByRole("tab", { name: "SEO y publicación" }).click();
  await page
    .getByLabel("Título SEO", { exact: true })
    .fill("Neuro Diversa · SEO QA");
  await page
    .getByLabel("Descripción SEO", { exact: true })
    .fill("Una descripción para verificar la publicación del sitio.");
  const publication = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/site/publish") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Publicar página", exact: true })
    .click();
  assert.equal((await publication).status(), 200);
  await page
    .getByText("Página publicada. El sitio ya usa esta versión.", {
      exact: true,
    })
    .waitFor();
  const html = await (await context.request.get(base + "/")).text();
  assert(html.includes("Conexiones de prueba QA"));
  assert(html.includes("<title>Neuro Diversa · SEO QA</title>"));
  assert(html.includes("Una descripción para verificar la publicación"));
  assert(
    !(await (await context.request.get(base + "/en/")).text()).includes(
      "Conexiones de prueba QA",
    ),
  );
  await page.getByRole("tab", { name: "Editor visual", exact: true }).click();
  const photo = frame.locator("img[data-studio-photo]").first();
  await photo.waitFor();
  await photo.click({ force: true });
  const bytes = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "#b8a58b" },
  })
    .jpeg()
    .toBuffer();
  await page
    .locator("input.visual-upload")
    .setInputFiles({
      name: "fotografia-qa.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });
  await page.waitForFunction(() =>
    document
      .querySelector(".visual-photo")
      ?.getAttribute("src")
      ?.startsWith("/api/admin/site/asset/"),
  );
  const privatePhoto = await page.locator(".visual-photo").getAttribute("src");
  const id = privatePhoto.split("/").at(-1);
  assert.equal(
    (await context.request.get(base + "/api/public/site-image/" + id)).status(),
    404,
  );
  assert.equal((await context.request.get(base + privatePhoto)).status(), 200);
  const photoPublication = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/site/publish") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Publicar página", exact: true })
    .click();
  assert.equal((await photoPublication).status(), 200);
  await page
    .getByText("Página publicada. El sitio ya usa esta versión.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    (await context.request.get(base + "/api/public/site-image/" + id)).status(),
    200,
  );
  assert(
    (await (await context.request.get(base + "/")).text()).includes(
      "/api/public/site-image/" + id,
    ),
  );
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  assert.equal(
    await frame
      .locator("h1 [data-studio-editable]")
      .first()
      .getAttribute("contenteditable"),
    "false",
  );
  await page.getByRole("button", { name: "Móvil", exact: true }).click();
  await page.screenshot({
    path: "/tmp/neurodiversa-qa/site-editor-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/neurodiversa-qa/site-editor-mobile.png",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      firefox: true,
      draftPrivate: true,
      publication: true,
      seo: true,
      photoPrivateUntilPublished: true,
      locales: true,
      mobile: true,
    }),
  );
} finally {
  await browser.close();
}
