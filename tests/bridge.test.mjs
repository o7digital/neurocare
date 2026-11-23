import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import bridge from "../api/backend.mjs";
import { createApplication } from "../backend/server.mjs";

test("Vercel bridge forwards same-origin widget cookies and preserves backend authentication boundaries", async (t) => {
  const key = "bridge-secret-".repeat(4);
  const app = await createApplication(
    {
      SITE_URL: "https://neurodiversa.mx",
      GATEWAY_KEY: key,
      AUTH_SECRET: "auth-key-".repeat(6),
      VAULT_KEY: "vault-key-".repeat(6),
      DB_PATH: ":memory:",
    },
    { providers: { health: async () => "3.6.0" }, disableWorker: true },
  );
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  process.env.NEURODIVERSA_BACKEND_URL = `http://127.0.0.1:${app.server.address().port}`;
  process.env.NEURODIVERSA_GATEWAY_KEY = key;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    req.body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : undefined;
    await bridge(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    app.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(base + "/api/backend?route=widget/session", {
    method: "POST",
    headers: {
      Origin: "https://neurodiversa.mx",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  response = await fetch(base + "/api/widget/messages", {
    headers: { Cookie: cookie.split(";")[0] },
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).messages, []);
  response = await fetch(base + "/api/admin/inbox");
  assert.equal(response.status, 401);
  response = await fetch(base + "/api/backend?route=widget/session", {
    method: "POST",
    headers: {
      Origin: "https://attacker.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(response.status, 403);
  response = await fetch(base + "/api/backend?route=..%2Fhealth");
  assert.equal(response.status, 404);
  response = await fetch(base + "/api/widget/status");
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.ok(!body.includes(key));
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("private chat attachments cross the Vercel bridge with download headers and visitor isolation", async (t) => {
  const key = "private-download-gateway-".repeat(3),
    site = "https://neurodiversa.mx";
  const app = await createApplication(
    {
      SITE_URL: site,
      GATEWAY_KEY: key,
      AUTH_SECRET: "attachment-auth-".repeat(5),
      VAULT_KEY: "attachment-vault-".repeat(5),
      DB_PATH: ":memory:",
    },
    { providers: { health: async () => "3.6.0" }, disableWorker: true },
  );
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  process.env.NEURODIVERSA_BACKEND_URL = `http://127.0.0.1:${app.server.address().port}`;
  process.env.NEURODIVERSA_GATEWAY_KEY = key;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    req.body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : undefined;
    await bridge(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    app.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { user } = await app.auth.api.signUpEmail({
    body: {
      name: "Download QA",
      email: "download@example.test",
      password: "Only-an-isolated-test-2026!",
    },
  });
  app.store.db
    .prepare("INSERT INTO members VALUES (?,?)")
    .run(user.id, "owner");
  const send = (path, body, cookie = "") =>
    fetch(base + "/api/" + path, {
      method: "POST",
      headers: {
        Origin: site,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  const login = await send("auth/sign-in/email", {
      email: "download@example.test",
      password: "Only-an-isolated-test-2026!",
    }),
    owner = login.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  const session = await send("widget/session", {}),
    visitor = session.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
    id = app.store.db
      .prepare("SELECT id FROM visitors ORDER BY rowid DESC LIMIT 1")
      .get().id;
  app.store.db
    .prepare(
      "INSERT INTO messages VALUES ('bridge-message',?,'visitor','Información del grupo',?,NULL)",
    )
    .run(id, new Date().toISOString());
  const data = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(150000, 32),
    ]),
    path = `admin/channel/conversations/${id}`;
  const upload = await send(
    path + "/attachments",
    { name: "informacion.pdf", base64: data.toString("base64") },
    owner,
  );
  assert.equal(upload.status, 200);
  const file = await upload.json();
  const detail = await (
    await fetch(base + "/api/" + path, { headers: { Cookie: owner } })
  ).json();
  const mode = await fetch(base + "/api/" + path + "/status", {
    method: "PATCH",
    headers: {
      Origin: site,
      "Content-Type": "application/json",
      Cookie: owner,
    },
    body: JSON.stringify({
      mode: "manual",
      version: detail.conversation.version,
    }),
  });
  assert.equal(mode.status, 200);
  const { randomUUID } = await import("node:crypto");
  assert.equal(
    (
      await send(
        path + "/reply",
        {
          content: "Documento",
          attachmentId: file.id,
          requestId: randomUUID(),
        },
        owner,
      )
    ).status,
    200,
  );
  const response = await fetch(base + "/api/widget/attachments/" + file.id, {
    headers: { Cookie: visitor },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.match(response.headers.get("content-security-policy"), /sandbox/);
  assert.equal((await response.arrayBuffer()).byteLength, data.length);
  assert.equal(
    (await fetch(base + "/api/widget/attachments/" + file.id)).status,
    401,
  );
});
