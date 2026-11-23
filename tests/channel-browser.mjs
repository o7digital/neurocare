// Isolated Firefox contract test for the full Olivia channel manager.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const { firefox } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await firefox.launch({ headless: true }),
  visitorContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  adminContext = await browser.newContext({
    viewport: { width: 1710, height: 950 },
  }),
  visitor = await visitorContext.newPage(),
  admin = await adminContext.newPage(),
  errors = [];
for (const p of [visitor, admin])
  p.on("pageerror", (e) => errors.push(e.message));
admin.on("dialog", (d) => d.accept());
const base = "http://127.0.0.1:4328",
  shots = "/tmp/neurodiversa-qa";
mkdirSync(shots, { recursive: true });
try {
  await visitor.goto(base + "/programas/habilidades-sociales/");
  await visitor
    .getByRole("button", { name: "Me interesa el grupo", exact: true })
    .click();
  const widget = visitor.locator("#neurodiversa-olivia");
  for (const [name, value] of Object.entries({
    firstName: "Ana",
    lastName: "Canal QA",
    email: "channel-qa@example.test",
    phone: "+52 5551112233",
  }))
    await widget.locator(`input[name=${name}]`).fill(value);
  await widget
    .locator("textarea[name=message]")
    .fill("Me interesa conocer los horarios y las condiciones del grupo.");
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
  await visitor.goto(base + "/blog/");
  await visitor.waitForTimeout(700);
  await admin.goto(base + "/inbox/");
  await admin.locator("input[name=email]").fill("reviewer@example.test");
  await admin
    .locator("input[name=password]")
    .fill("Neurodiversa-QA-only-2026!");
  await admin
    .getByRole("button", { name: "Entrar al workspace", exact: true })
    .click();
  await admin.locator(".olivia-console").waitFor();
  await admin.getByLabel("Language", { exact: true }).selectOption("en");
  await admin.getByRole("button", { name: "Take over", exact: true }).waitFor();
  await admin
    .locator(".oc-thread-row")
    .filter({ hasText: "Ana Canal QA" })
    .click();
  const composer = admin.getByRole("textbox", {
    name: "Write a reply to the customer…",
    exact: true,
  });
  assert.equal(await composer.isDisabled(), true);
  await admin.screenshot({
    path: shots + "/channel-reference-desktop.png",
    animations: "disabled",
  });
  await admin
    .getByRole("button", { name: "Add customer tag", exact: true })
    .click();
  await admin.getByRole("textbox", { name: "Tags", exact: true }).fill("Grupo");
  await admin
    .getByRole("textbox", { name: "Tags", exact: true })
    .press("Enter");
  await admin
    .locator(".oc-tag-list")
    .getByText("Grupo", { exact: true })
    .waitFor();
  await admin.getByRole("button", { name: "Take over", exact: true }).click();
  await admin
    .getByRole("button", { name: "Return to AI", exact: true })
    .waitFor();
  assert.equal(await composer.isEnabled(), true);
  await admin.getByRole("tab", { name: "Notes", exact: true }).click();
  await admin
    .getByRole("textbox", { name: "Internal note", exact: true })
    .fill("Confirmar disponibilidad antes de inscribir. Nota privada QA.");
  await admin.getByRole("button", { name: "Add note", exact: true }).click();
  await admin
    .locator(".oc-internal-note")
    .getByText(
      "Confirmar disponibilidad antes de inscribir. Nota privada QA.",
      { exact: true },
    )
    .waitFor();
  await admin.getByRole("tab", { name: "Viewed pages", exact: true }).click();
  await admin
    .locator(".oc-page-history")
    .getByText("/blog/", { exact: true })
    .waitFor();
  await admin
    .locator(".oc-page-history")
    .getByText("/programas/habilidades-sociales/", { exact: true })
    .waitFor();
  await admin.screenshot({
    path: shots + "/channel-pages-desktop.png",
    animations: "disabled",
  });
  await admin
    .getByRole("button", { name: "Suggest an AI reply", exact: true })
    .click();
  await admin.waitForFunction(() =>
    document
      .querySelector(".oc-composer textarea")
      ?.value.includes("El equipo confirmará"),
  );
  assert.equal(await admin.locator(".oc-message.operator").count(), 0);
  await composer.fill(
    "Hola Ana, el equipo confirmará contigo los horarios del grupo.",
  );
  await admin
    .getByLabel("Attachment", { exact: true })
    .setInputFiles({
      name: "informacion-qa.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Información de prueba aislada del programa."),
    });
  await admin.getByRole("button", { name: "Reply", exact: true }).click();
  await admin
    .locator(".oc-message.operator")
    .getByText(
      "Hola Ana, el equipo confirmará contigo los horarios del grupo.",
      { exact: true },
    )
    .waitFor();
  await visitor
    .getByRole("button", { name: "Abrir Olivia AI", exact: true })
    .click();
  await visitor
    .getByText(
      "Hola Ana, el equipo confirmará contigo los horarios del grupo.",
      { exact: true },
    )
    .waitFor({ timeout: 20000 });
  const attachment = visitor.locator("a.olivia-attachment");
  await attachment.waitFor();
  const response = await visitorContext.request.get(
    base + (await attachment.getAttribute("href")),
  );
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-disposition"], /attachment/);
  assert.match(await response.text(), /Información de prueba aislada/);
  assert.equal(
    (await visitor.locator(".olivia-messages").innerText()).includes(
      "Nota privada QA",
    ),
    false,
  );
  await admin.getByRole("tab", { name: "Info", exact: true }).click();
  await admin.screenshot({
    path: shots + "/channel-manual-desktop.png",
    animations: "disabled",
  });
  await admin
    .getByRole("button", { name: "Return to AI", exact: true })
    .click();
  await admin.getByRole("button", { name: "Take over", exact: true }).waitFor();
  await admin.getByRole("button", { name: "Solve", exact: true }).click();
  await admin.getByRole("button", { name: "Reopen", exact: true }).waitFor();
  const state = await (
    await adminContext.request.get(
      base + "/api/admin/channel/conversations?view=solved",
    )
  ).json();
  assert.ok(state.conversations.some((c) => c.name === "Ana Canal QA"));
  const id = state.conversations.find((c) => c.name === "Ana Canal QA").id;
  await admin.reload();
  await admin.getByRole("button", { name: "Reopen", exact: true }).waitFor();
  await admin.getByRole("tab", { name: /^Notes/ }).click();
  await admin
    .locator(".oc-internal-note")
    .getByText(
      "Confirmar disponibilidad antes de inscribir. Nota privada QA.",
      { exact: true },
    )
    .waitFor();
  await visitor.locator("#neurodiversa-olivia input[name=chatConsent]").check();
  await visitor
    .locator(".olivia-composer input[name=message]")
    .fill("Gracias, ¿puedo solicitar información?");
  await visitor
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Take over", exact: true })
    .waitFor({ timeout: 15000 });
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.waitForTimeout(350);
  await admin.screenshot({
    path: shots + "/channel-mobile-chat.png",
    animations: "disabled",
  });
  assert.ok(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await admin.getByRole("button", { name: "Info", exact: true }).click();
  await admin.getByRole("tab", { name: /^Notes/ }).click();
  await admin.screenshot({
    path: shots + "/channel-mobile-notes.png",
    animations: "disabled",
  });
  await admin.locator(".oc-info-close").click();
  await admin
    .getByRole("button", { name: "Back to Inbox", exact: true })
    .click();
  await admin.locator(".oc-list").waitFor({ state: "visible" });
  await admin.screenshot({
    path: shots + "/channel-mobile-list.png",
    animations: "disabled",
  });
  assert.ok(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Channel manager Firefox QA passed: reference layout, consented page history, tags, manual takeover, private notes, AI draft, private attachment delivered to visitor, resolve/reopen, persistence, desktop and mobile.",
  );
} catch (error) {
  await admin
    .screenshot({
      path: shots + "/channel-failure-admin.png",
      animations: "disabled",
    })
    .catch(() => {});
  await visitor
    .screenshot({
      path: shots + "/channel-failure-visitor.png",
      animations: "disabled",
    })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
