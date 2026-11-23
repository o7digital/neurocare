import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server.mjs";
import { createProviders, renderMail } from "../providers.mjs";

const environment = () => ({
  SITE_URL: "http://localhost:4321",
  GATEWAY_KEY: "gateway-key-".repeat(4),
  AUTH_SECRET: "auth-secret-".repeat(4),
  VAULT_KEY: "vault-secret-".repeat(4),
  DB_PATH: ":memory:",
});
function fixtures() {
  let calls = { chat: 0, email: 0, buffer: 0, mailchimp: 0 };
  return {
    calls,
    health: async () => "3.6.0",
    chat: async () => {
      calls.chat++;
      return {
        answer:
          "Información del grupo. Usa el formulario para recibir seguimiento.",
        conversation_id: "a".repeat(24),
      };
    },
    bufferChannels: async () => ({
      organization: { id: "org", name: "Neuro Diversa" },
      channels: [{ id: "channel", name: "Neuro Diversa", service: "facebook" }],
    }),
    mailchimpPing: async () => ({ ok: true }),
    mailchimpDraft: async (config, campaign, onCreated) => {
      calls.mailchimp++;
      onCreated("mc-draft");
      return { id: "mc-draft" };
    },
    bufferPosts: async () => ({
      posts: {
        "buffer-post": {
          id: "buffer-post",
          text: "Changed in Buffer",
          status: "draft",
        },
      },
    }),
    bufferPost: async () => {
      calls.buffer++;
      return { id: "buffer-post" };
    },
    sendMail: async () => {
      calls.email++;
      return { messageId: "message" };
    },
    unsubscribe: (id) => `${id}.signed-test-token`,
  };
}
async function harness(custom = {}) {
  const env = { ...environment(), ...custom },
    providers = fixtures(),
    app = await createApplication(env, { providers, disableWorker: true });
  async function request(
    path,
    {
      method = "GET",
      body,
      cookie = "",
      key = env.GATEWAY_KEY,
      origin = env.SITE_URL,
    } = {},
  ) {
    const response = await app.handle(
      new Request(env.SITE_URL + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-neurodiversa-key": key,
          origin,
          cookie,
          "x-visitor-ip": "127.0.0.1",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
    const cookies = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return { status: response.status, data, cookie: cookies };
  }
  async function actor(role = "owner", email = `${randomUUID()}@example.test`) {
    const invitation = new URL(app.invite(email, role)).searchParams.get(
      "invite",
    );
    const accepted = await request("/api/invitations/accept", {
      method: "POST",
      body: {
        token: invitation,
        name: "Prueba del equipo",
        password: "A-private-test-password-921!",
      },
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    const login = await request("/api/auth/sign-in/email", {
      method: "POST",
      body: { email, password: "A-private-test-password-921!" },
    });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    assert.ok(login.cookie);
    return { cookie: login.cookie, invitation };
  }
  return { app, providers, env, request, actor };
}

test("private workspace rejects missing gateway, anonymous access, cross-origin writes and public signup", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  assert.equal(
    (await h.request("/api/admin/inbox", { key: "invalid" })).status,
    401,
  );
  assert.equal((await h.request("/api/admin/inbox")).status, 401);
  assert.equal(
    (
      await h.request("/api/widget/session", {
        method: "POST",
        body: {},
        origin: "https://unrelated.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/auth/sign-up/email", {
        method: "POST",
        body: { email: "outsider@example.test", password: "irrelevant" },
      })
    ).status,
    404,
  );
  const a = await h.actor();
  assert.equal(
    (await h.request("/api/admin/inbox", { cookie: a.cookie })).status,
    200,
  );
  assert.equal(
    (
      await h.request("/api/invitations/accept", {
        method: "POST",
        body: {
          token: a.invitation,
          name: "Replay",
          password: "A-private-test-password-921!",
        },
      })
    ).status,
    400,
  );
});

test("Olivia captures group lead directly, isolates visitor conversations and supports operator takeover", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie: admin } = await h.actor();
  const session = await h.request("/api/widget/session", {
    method: "POST",
    body: {},
  });
  assert.match(session.cookie, /nd_visitor=/);
  const message = {
    message: "Quiero información del grupo",
    language: "es",
    consent: true,
    requestId: randomUUID(),
    page: "/programas/habilidades-sociales/",
  };
  assert.equal(
    (
      await h.request("/api/widget/chat", {
        method: "POST",
        cookie: session.cookie,
        body: message,
      })
    ).status,
    200,
  );
  await h.request("/api/widget/chat", {
    method: "POST",
    cookie: session.cookie,
    body: message,
  });
  assert.equal(h.providers.calls.chat, 1);
  const lead = {
    firstName: "Paciente",
    lastName: "Prueba",
    email: "patient@example.test",
    phone: "+52 555 000 0000",
    interest: "group",
    message: "Información sobre horarios",
    consent: true,
    marketingConsent: false,
    page: "/programas/habilidades-sociales/",
  };
  assert.equal(
    (
      await h.request("/api/widget/leads", {
        method: "POST",
        cookie: session.cookie,
        body: { ...lead, consent: false },
      })
    ).status,
    400,
  );
  await h.request("/api/widget/leads", {
    method: "POST",
    cookie: session.cookie,
    body: lead,
  });
  await h.request("/api/widget/leads", {
    method: "POST",
    cookie: session.cookie,
    body: lead,
  });
  const inbox = await h.request("/api/admin/inbox", { cookie: admin });
  assert.equal(inbox.data.leads.length, 1);
  assert.equal(inbox.data.leads[0].interest, "group");
  assert.equal(
    (await h.request("/api/admin/contacts", { cookie: admin })).data.contacts
      .length,
    0,
  );
  const visitor = inbox.data.leads[0].visitor_id;
  await h.request(`/api/admin/conversations/${visitor}`, {
    method: "POST",
    cookie: admin,
    body: { content: "Hola, el equipo te acompaña." },
  });
  const response = await h.request("/api/widget/messages", {
    cookie: session.cookie,
  });
  assert.equal(response.data.mode, "manual");
  assert.deepEqual(
    response.data.messages.map((m) => m.role),
    ["visitor", "assistant", "operator"],
  );
  await h.request("/api/widget/chat", {
    method: "POST",
    cookie: session.cookie,
    body: { ...message, requestId: randomUUID(), message: "Gracias" },
  });
  assert.equal(h.providers.calls.chat, 1);
  const other = await h.request("/api/widget/session", {
    method: "POST",
    body: {},
  });
  assert.deepEqual(
    (await h.request("/api/widget/messages", { cookie: other.cookie })).data
      .messages,
    [],
  );
});

test("published content is shared; drafts are private; concurrent edits are rejected", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie } = await h.actor();
  const post = {
    title: "Un artículo",
    author: "Cindy",
    category: "Psicología",
    body: "Contenido del equipo",
    language: "es",
    status: "draft",
  };
  const saved = await h.request("/api/admin/posts", {
    method: "POST",
    cookie,
    body: post,
  });
  assert.equal(saved.status, 200);
  assert.equal((await h.request("/api/public/content")).data.posts.length, 0);
  assert.equal(
    (
      await h.request("/api/admin/posts", {
        method: "POST",
        cookie,
        body: { ...post, id: saved.data.id, version: 1, status: "published" },
      })
    ).status,
    200,
  );
  assert.equal((await h.request("/api/public/content")).data.posts.length, 1);
  assert.equal(
    (await h.request("/api/public/content?language=en")).data.posts.length,
    0,
  );
  assert.equal(
    (
      await h.request("/api/admin/posts", {
        method: "POST",
        cookie,
        body: { ...post, id: saved.data.id, version: 1 },
      })
    ).status,
    409,
  );
  await h.request("/api/admin/program", {
    method: "PUT",
    cookie,
    body: { title: "Grupo", start: "Enero 2027", weeks: 16, minutes: 90 },
  });
  assert.equal((await h.request("/api/public/content")).data.program.weeks, 16);
});

test("mailing requires opt-in, respects unsubscribe, queues persistently and never repeats a dispatch", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie } = await h.actor();
  await h.request("/api/admin/connections", {
    method: "PATCH",
    cookie,
    body: {
      smtp: {
        host: "smtp.example.test",
        port: 587,
        username: "test",
        password: "private-smtp-password",
        fromEmail: "team@example.test",
        fromName: "Neuro Diversa",
      },
    },
  });
  const config = (await h.request("/api/admin/workspace", { cookie })).data
    .connections;
  assert.equal(config.smtp.password, undefined);
  assert.equal(config.smtp.configured, true);
  assert.ok(
    !h.app.store.db
      .prepare("SELECT value FROM settings")
      .all()[0]
      .value.includes("private-smtp-password"),
  );
  assert.equal(
    (
      await h.request("/api/admin/contacts", {
        method: "POST",
        cookie,
        body: {
          email: "consent@example.test",
          firstName: "Prueba",
          consent: false,
          consentSource: "Formulario de prueba",
        },
      })
    ).status,
    400,
  );
  await h.request("/api/admin/contacts", {
    method: "POST",
    cookie,
    body: {
      email: "consent@example.test",
      firstName: "Prueba",
      consent: true,
      consentSource: "Formulario de prueba, 23 noviembre",
    },
  });
  const contact = (await h.request("/api/admin/contacts", { cookie })).data
    .contacts[0];
  const campaign = {
    kind: "email",
    subject: "Newsletter",
    body: "Hola {{firstName}}",
  };
  const saved = (
    await h.request("/api/admin/campaigns", {
      method: "POST",
      cookie,
      body: campaign,
    })
  ).data;
  const dispatch = () =>
    h.request(`/api/admin/campaigns/${saved.id}/send`, {
      method: "POST",
      cookie,
      body: { version: 1, confirmed: true, recipientIds: [contact.id] },
    });
  assert.equal((await dispatch()).data.results[0].status, "queued");
  assert.equal(h.providers.calls.email, 0);
  await h.app.processJobs();
  assert.equal(h.providers.calls.email, 1);
  assert.equal((await dispatch()).data.results[0].status, "already_recorded");
  await h.app.processJobs();
  assert.equal(h.providers.calls.email, 1);
  await h.request("/api/admin/campaigns", {
    method: "POST",
    cookie,
    body: { ...campaign, id: saved.id, version: 1 },
  });
  assert.equal(
    (await h.request("/api/admin/workspace", { cookie })).data.campaigns[0]
      .version,
    1,
  );
  const token = h.providers.unsubscribe(contact.id);
  await h.request(`/api/unsubscribe?token=${token}`, { method: "POST" });
  const next = (
    await h.request("/api/admin/campaigns", {
      method: "POST",
      cookie,
      body: { ...campaign, subject: "Otra campaña" },
    })
  ).data;
  assert.equal(
    (
      await h.request(`/api/admin/campaigns/${next.id}/send`, {
        method: "POST",
        cookie,
        body: { version: 1, confirmed: true, recipientIds: [contact.id] },
      })
    ).status,
    400,
  );
  assert.ok(
    !JSON.stringify(
      (await h.request("/api/admin/workspace", { cookie })).data,
    ).includes("private-smtp-password"),
  );
});

test("editor cannot change provider credentials or invite accounts", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie } = await h.actor("editor");
  assert.equal(
    (
      await h.request("/api/admin/connections", {
        method: "PATCH",
        cookie,
        body: { buffer: { apiKey: "not-allowed", organizationId: "org" } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/api/admin/invitations", {
        method: "POST",
        cookie,
        body: { email: "other@example.test" },
      })
    ).status,
    403,
  );
});

test("database survives restart; queued writes retain their snapshot and provider connection", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "neurodiversa-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...environment(), DB_PATH: join(dir, "private.sqlite") };
  let h = await harness(env);
  const { cookie } = await h.actor();
  await h.request("/api/admin/connections", {
    method: "PATCH",
    cookie,
    body: { buffer: { apiKey: "private-buffer-key", organizationId: "org" } },
  });
  const saved = (
    await h.request("/api/admin/campaigns", {
      method: "POST",
      cookie,
      body: {
        kind: "social",
        subject: "Publicación",
        body: "Texto",
        channelIds: ["channel"],
        mode: "draft",
      },
    })
  ).data;
  await h.request(`/api/admin/campaigns/${saved.id}/buffer`, {
    method: "POST",
    cookie,
    body: { version: 1, confirmed: true },
  });
  h.app.close();
  h = await harness(env);
  t.after(() => h.app.close());
  assert.equal(
    (await h.request("/api/admin/workspace", { cookie })).data.campaigns.length,
    1,
  );
  await h.app.processJobs();
  assert.equal(h.providers.calls.buffer, 1);
});

test("provider adapter fixes tenant identity, verifies Olivia 3.6 and uses Buffer scheduling contract", async () => {
  const calls = [];
  const env = {
    VAULT_KEY: "vault",
    OLIVIA_API_URL: "http://core",
    OLIVIA_EMAIL: "service",
    OLIVIA_PASSWORD: "private",
  };
  const fake = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url.endsWith("/health")) return Response.json({ version: "3.6.0" });
    if (url.endsWith("/login"))
      return Response.json({ access_token: "service-token" });
    if (url.endsWith("/chat"))
      return Response.json({
        answer: "Respuesta",
        conversation_id: "a".repeat(24),
      });
    return Response.json({ data: { createPost: { post: { id: "post" } } } });
  };
  const provider = createProviders(env, fake);
  await provider.chat("Hola");
  assert.equal(calls.at(-1).headers["X-Tenant-ID"], "neurodiversa");
  await provider.bufferPost(
    { apiKey: "private" },
    { id: "channel", service: "facebook" },
    {
      body: "Texto",
      mode: "scheduled",
      dueAt: new Date(Date.now() + 3600000).toISOString(),
    },
  );
  const query = JSON.parse(calls.at(-1).body).query;
  assert.match(query, /mode:customScheduled/);
  assert.match(query, /saveToDraft:false/);
  const bad = createProviders(env, async () =>
    Response.json({ version: "3.5.0" }),
  );
  await assert.rejects(() => bad.chat("Hola"));
  const html = renderMail(
    { subject: "Subject", body: "Hola {{firstName}} <script>bad</script>" },
    { first_name: "<img onerror=bad>" },
  ).html;
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;img/);
});

test("rich newsletter retains design and catalog, isolates drafts, publishes snapshots and prepares social drafts without duplicates", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie } = await h.actor();
  const event = {
    id: randomUUID(),
    category: "Programa grupal",
    title: "Una actividad",
    date: "Por confirmar",
    venue: "San Ángel",
    description: "Un recurso del equipo",
    url: "https://neurodiversa.mx/programas/habilidades-sociales/",
    sourceLabel: "Neuro Diversa",
    imageUrl: "",
  };
  assert.equal(
    (
      await h.request("/api/admin/catalog", {
        method: "POST",
        cookie,
        body: event,
      })
    ).status,
    200,
  );
  const campaign = {
    kind: "email",
    subject: "Agenda",
    body: "Hola {{firstName}}",
    bodyHtml:
      "<p>Hola <strong>{{firstName}}</strong></p><img src=x onerror=alert(1)><script>bad()</script>",
    month: "Noviembre",
    monthKey: "2026-11",
    year: 2026,
    events: [event],
    highlights: ["Un destacado"],
    heroImage: "https://neurodiversa.mx/dra-ariadna-mondragon.jpg",
    headline: "Conectemos",
    design: {
      gallery: [],
      address: "San Ángel",
      phone: "55 7191 9515",
      websiteUrl: "https://neurodiversa.mx",
      reservationUrl: "https://neurodiversa.mx",
      heroImage: "",
    },
  };
  const saved = await h.request("/api/admin/campaigns", {
    method: "POST",
    cookie,
    body: campaign,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.version, 1);
  const doc = (await h.request("/api/admin/workspace", { cookie })).data
    .campaigns[0];
  assert.equal(doc.events[0].id, event.id);
  assert.equal(doc.design.address, "San Ángel");
  assert.ok(!doc.bodyHtml.includes("script"));
  assert.ok(!doc.bodyHtml.includes("onerror"));
  const first = await h.request(
    `/api/admin/campaigns/${doc.id}/prepare-social`,
    { method: "POST", cookie, body: { version: 1 } },
  );
  assert.equal(first.data.created.length, 1);
  const social = (
    await h.request("/api/admin/workspace", { cookie })
  ).data.campaigns.find((c) => c.kind === "social");
  await h.request("/api/admin/campaigns", {
    method: "POST",
    cookie,
    body: { ...social, body: "Texto personalizado" },
  });
  const again = await h.request(
    `/api/admin/campaigns/${doc.id}/prepare-social`,
    { method: "POST", cookie, body: { version: 1 } },
  );
  assert.equal(again.data.created.length, 0);
  assert.equal(
    (await h.request("/api/admin/workspace", { cookie })).data.campaigns.find(
      (c) => c.kind === "social",
    ).body,
    "Texto personalizado",
  );
  const published = await h.request(`/api/admin/campaigns/${doc.id}/publish`, {
    method: "POST",
    cookie,
    body: { version: 1 },
  });
  assert.equal(published.status, 200);
  const publicPath = `/api/public/agenda/${published.data.id}`;
  const snapshot = (await h.request(publicPath)).data;
  assert.equal(snapshot.subject, "Agenda");
  assert.equal(snapshot.segment, undefined);
  await h.request("/api/admin/campaigns", {
    method: "POST",
    cookie,
    body: { ...doc, subject: "Private change" },
  });
  assert.equal((await h.request(publicPath)).data.subject, "Agenda");
  assert.equal(
    (
      await h.request(`/api/admin/campaigns/${doc.id}/publish`, {
        method: "POST",
        cookie,
        body: { version: 1 },
      })
    ).status,
    409,
  );
  await h.request(`/api/admin/publications/${published.data.id}`, {
    method: "DELETE",
    cookie,
  });
  assert.equal((await h.request(publicPath)).status, 404);
  const preview = renderMail(
    doc,
    { first_name: "<img src=x onerror=bad>" },
    "https://neurodiversa.mx/api/unsubscribe?token=test",
  ).html;
  assert.match(preview, /Un destacado/);
  assert.match(preview, /Una actividad/);
  assert.match(preview, /&lt;img/);
  assert.ok(!preview.includes("*|UNSUB|*"));
});

test("media upload validates decoded images and serves a normalized public JPEG without private data", async (t) => {
  const { default: sharp } = await import("sharp");
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie } = await h.actor();
  assert.equal(
    (
      await h.request("/api/admin/media", {
        method: "POST",
        body: {
          name: "bad.svg",
          base64: Buffer.from("<svg><script>alert(1)</script></svg>").toString(
            "base64",
          ),
        },
        cookie,
      })
    ).status,
    400,
  );
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#87424d" },
  })
    .png()
    .toBuffer();
  const saved = await h.request("/api/admin/media", {
    method: "POST",
    body: { name: "test.png", base64: png.toString("base64") },
    cookie,
  });
  assert.equal(saved.status, 200);
  const response = await h.app.handle(
    new Request(h.env.SITE_URL + `/api/public/media/${saved.data.id}`, {
      headers: { "x-neurodiversa-key": h.env.GATEWAY_KEY },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  const metadata = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 900);
  const media = (await h.request("/api/admin/workspace", { cookie })).data
    .media;
  assert.equal(media.length, 1);
  assert.equal(media[0].bytes, undefined);
});

test("Mailchimp draft outbox stores remote identity before content failure and never duplicates a retry; secrets stay private", async (t) => {
  const h = await harness();
  t.after(() => h.app.close());
  const { cookie } = await h.actor();
  const config = {
    apiKey: "private-mc-key",
    serverPrefix: "us21",
    audienceId: "list",
    fromEmail: "team@example.test",
    replyTo: "team@example.test",
    fromName: "Neuro Diversa",
    accountLabel: "Neuro Diversa",
  };
  await h.request("/api/admin/connections", {
    method: "PATCH",
    cookie,
    body: { mailchimp: config },
  });
  const doc = (
    await h.request("/api/admin/campaigns", {
      method: "POST",
      cookie,
      body: { kind: "email", subject: "Un borrador", body: "Contenido" },
    })
  ).data;
  h.providers.mailchimpDraft = async (config, campaign, onCreated) => {
    h.providers.calls.mailchimp++;
    onCreated("remote-created");
    throw new Error("Content timeout");
  };
  const path = `/api/admin/campaigns/${doc.id}/mailchimp`,
    body = { version: 1, confirmed: true };
  assert.equal(
    (await h.request(path, { method: "POST", cookie, body })).data.results[0]
      .status,
    "queued",
  );
  await h.app.processJobs();
  const workspace = (await h.request("/api/admin/workspace", { cookie })).data;
  assert.equal(workspace.deliveries[0].status, "unconfirmed");
  assert.equal(workspace.deliveries[0].remote_id, "remote-created");
  assert.ok(!JSON.stringify(workspace).includes(config.apiKey));
  assert.equal(
    (await h.request(path, { method: "POST", cookie, body })).data.results[0]
      .status,
    "already_recorded",
  );
  await h.app.processJobs();
  assert.equal(h.providers.calls.mailchimp, 1);
});

test("Mailchimp adapter creates only a draft and Buffer status pagination is complete", async () => {
  const calls = [];
  const provider = createProviders(
    { VAULT_KEY: "vault" },
    async (url, options = {}) => {
      calls.push({ url, ...options });
      if (url.endsWith("/content")) return Response.json({ html: "saved" });
      if (url.endsWith("/campaigns"))
        return Response.json({ id: "mc-created" });
      const query = JSON.parse(options.body).query;
      if (query.includes("account {"))
        return Response.json({
          data: { account: { organizations: [{ id: "org", name: "ND" }] } },
        });
      if (query.includes("channels("))
        return Response.json({
          data: { channels: [{ id: "ch", name: "ND", service: "facebook" }] },
        });
      return Response.json({
        data: {
          posts: {
            edges: [
              {
                node: {
                  id: query.includes("after:") ? "second" : "first",
                  text: "Text",
                  status: "draft",
                },
              },
            ],
            pageInfo: {
              hasNextPage: !query.includes("after:"),
              endCursor: "next",
            },
          },
        },
      });
    },
  );
  let remote = "";
  await provider.mailchimpDraft(
    {
      apiKey: "private",
      serverPrefix: "us21",
      audienceId: "list",
      fromName: "ND",
      replyTo: "team@example.test",
    },
    {
      subject: "Subject",
      body: "Hola {{firstName}}",
      highlights: [],
      events: [],
      month: "Noviembre",
    },
    (id) => {
      remote = id;
    },
  );
  assert.equal(remote, "mc-created");
  assert.equal(calls.filter((c) => c.url.endsWith("/campaigns")).length, 1);
  assert.ok(!calls.some((c) => c.url.includes("/actions/send")));
  assert.match(
    JSON.parse(calls.find((c) => c.url.endsWith("/content")).body).html,
    /\*\|FNAME\|\*/,
  );
  const posts = await provider.bufferPosts({
    apiKey: "private",
    organizationId: "org",
  });
  assert.deepEqual(Object.keys(posts.posts), ["first", "second"]);
});
