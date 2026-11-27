// Isolated Firefox: two users -> autosave -> columns/media -> public rendering.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const { firefox } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = createRequire(
  new URL("../backend/package.json", import.meta.url),
)("sharp");
const browser = await firefox.launch({ headless: true });
const base = "http://127.0.0.1:4328",
  errors = [];
const contexts = await Promise.all([
  browser.newContext({ viewport: { width: 1600, height: 1100 } }),
  browser.newContext({ viewport: { width: 1600, height: 1100 } }),
]);
const pages = await Promise.all(contexts.map((context) => context.newPage()));
const program = "/programas/habilidades-sociales/";
const frameOf = (page) =>
  page.frameLocator('iframe[title="Página de Neuro Diversa · Editor visual"]');
async function login(page, email) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/admin/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill("Neurodiversa-QA-only-2026!");
  await page
    .getByRole("button", { name: "Entrar al workspace", exact: true })
    .click();
  await page.getByRole("button", { name: /^Editar el sitio/ }).click();
  await page
    .locator(".site-pages-list button")
    .filter({ hasText: program })
    .click();
  await frameOf(page).locator(".group-title [data-studio-editable]").waitFor();
}
async function selectText(locator) {
  await locator.evaluate((node) => {
    node.focus();
    const range = node.ownerDocument.createRange();
    range.selectNodeContents(node);
    const selection = node.ownerDocument.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    node.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
}
try {
  await Promise.all([
    login(pages[0], "reviewer@example.test"),
    login(pages[1], "editor@example.test"),
  ]);
  const [a, b] = pages,
    frame = frameOf(a),
    lead = frame.locator(".group-copy .lead [data-studio-editable]");
  const saved = a.waitForResponse(
    (r) => r.url().endsWith("/api/admin/site/save") && r.status() === 200,
  );
  await lead.fill("Texto compartido de Montserrat QA");
  await saved;
  await frameOf(b)
    .locator(".group-copy .lead [data-studio-editable]")
    .filter({ hasText: "Texto compartido de Montserrat QA" })
    .waitFor();
  assert(
    !(await (await contexts[0].request.get(base + program)).text()).includes(
      "Texto compartido de Montserrat QA",
    ),
  );
  await selectText(lead);
  await a.getByRole("button", { name: "Negrita", exact: true }).click();
  assert.match(await lead.innerHTML(), /<(b|strong)>/);
  await selectText(lead);
  await a.getByLabel("Tamaño de letra", { exact: true }).selectOption("24");
  assert.match(await lead.innerHTML(), /data-size="24"/);
  await selectText(lead);
  await a.getByLabel("Tipografía del texto").selectOption("georgia");
  assert.match(await lead.innerHTML(), /data-font="georgia"/);
  await a
    .getByRole("button", {
      name: "Convertir este texto en bloque",
      exact: true,
    })
    .click();
  await a.getByRole("button", { name: "+ Columnas", exact: true }).click();
  const columnId = await a
    .locator(".page-block-card")
    .filter({ has: a.getByLabel("Número de columnas", { exact: true }) })
    .getAttribute("data-block-card");
  await a
    .locator(".page-blocks-editor > .page-block-card")
    .first()
    .getByLabel("Mover bloque a columna", { exact: true })
    .selectOption(`${columnId}:0`);
  const columns = a.locator(".page-block-columns > div");
  await columns
    .nth(0)
    .getByRole("button", { name: "+ Texto", exact: true })
    .click();
  const content = columns.nth(0).locator(".tiptap").last();
  await content.fill("Contenido en columnas QA");
  await a
    .getByLabel("Tamaño de letra del bloque", { exact: true })
    .last()
    .selectOption("24");
  await a
    .getByLabel("Tipografía del bloque", { exact: true })
    .last()
    .selectOption("georgia");
  await columns
    .nth(1)
    .getByRole("button", { name: "+ Foto", exact: true })
    .click();
  const photo = await sharp({
    create: { width: 640, height: 400, channels: 3, background: "#ad95a7" },
  })
    .png()
    .toBuffer();
  await a
    .getByLabel("Importar fotografía", { exact: true })
    .setInputFiles({
      name: "foto-qa.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await a
    .locator(".page-block-media img[src^='/api/admin/site/asset/']")
    .waitFor();
  const photoUrl = await a.locator(".page-block-media img").getAttribute("src");
  assert.equal(
    (
      await contexts[0].request.get(
        base +
          photoUrl.replace("/api/admin/site/asset/", "/api/public/site-image/"),
      )
    ).status(),
    404,
  );
  await columns
    .nth(1)
    .getByRole("button", { name: "+ Vídeo", exact: true })
    .click();
  await a
    .getByLabel("Importar vídeo", { exact: true })
    .setInputFiles("/tmp/neurodiversa-qa-video.mp4");
  await a
    .locator(".page-block-media video[src^='/api/admin/site/asset/']")
    .waitFor();
  const videoUrl = await a
    .locator(".page-block-media video")
    .getAttribute("src");
  assert.equal(
    (await contexts[0].request.get(base + videoUrl)).headers()["content-type"],
    "video/mp4",
  );
  await a.getByRole("tab", { name: "Editor visual", exact: true }).click();
  await frame.locator(".nd-block-columns").waitFor();
  assert.equal(await frame.locator(".nd-block-column").count(), 2);
  await frame
    .locator('[data-studio-text*="block:"]')
    .filter({ hasText: "Contenido en columnas QA" })
    .waitFor();
  const publish = a.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/site/publish") &&
      r.request().method() === "POST",
  );
  await a.getByRole("button", { name: "Publicar página", exact: true }).click();
  assert.equal((await publish).status(), 200);
  const html = await (await contexts[0].request.get(base + program)).text();
  assert(html.includes("Texto compartido de Montserrat QA"));
  assert(html.includes("Contenido en columnas QA"));
  assert(html.includes("--nd-columns:2"));
  assert(html.includes('data-size="24"'));
  assert(html.includes("font-size:24px;font-family:Georgia"));
  assert.equal(
    (
      await contexts[0].request.get(
        base +
          videoUrl.replace("/api/admin/site/asset/", "/api/public/site-image/"),
      )
    ).status(),
    200,
  );
  const publicPage = await contexts[0].newPage();
  await publicPage.goto(base + program);
  await publicPage.locator("video").evaluate(
    (video) =>
      new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error("Video metadata failed"));
        video.load();
      }),
  );
  await publicPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await publicPage
      .locator(".nd-block-columns")
      .evaluate(
        (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
      ),
    1,
  );
  assert(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mkdir("/tmp/neurodiversa-qa", { recursive: true });
  await publicPage.locator(".nd-block-columns img").scrollIntoViewIfNeeded();
  await publicPage.waitForFunction(
    () =>
      document.querySelector(".nd-block-columns img").complete &&
      document.querySelector(".nd-block-columns img").naturalWidth > 0,
  );
  await publicPage
    .locator(".nd-block-columns img")
    .evaluate((img) => img.decode());
  await a.screenshot({ path: "/tmp/neurodiversa-qa/builder-desktop.png" });
  await publicPage.screenshot({
    path: "/tmp/neurodiversa-qa/builder-public-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      firefox: true,
      twoUsers: true,
      autosave: true,
      sharedDraft: true,
      typography: true,
      columns: true,
      photoUpload: true,
      videoUploadAndPlayback: true,
      publication: true,
      mobile: true,
    }),
  );
} finally {
  await browser.close();
}
