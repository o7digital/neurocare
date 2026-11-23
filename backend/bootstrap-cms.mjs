// Run inside the dedicated neurodiversa-cms container. Additive and idempotent.
import { readFile } from "node:fs/promises";
const seed = JSON.parse(
  await readFile("/tmp/neurodiversa-cms-seed.json", "utf8"),
);
if (
  seed.site !== "neurodiversa" ||
  process.env.DB_DATABASE !== "neurodiversa_cms"
)
  throw new Error("Dedicated Neuro Diversa CMS required");
const base = "http://127.0.0.1:8055";
let token;
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `${method} ${path.split("?")[0]}: ${response.status} ${JSON.stringify(data.errors?.map((e) => ({ code: e.extensions?.code, field: e.extensions?.field, type: e.extensions?.type })))}`,
    );
  return data.data;
}
const login = await api("/auth/login", "POST", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
token = login.access_token;
const field = (name, type = "string", options = {}) => ({
  field: name,
  type,
  schema: {
    is_nullable: true,
    ...(type === "string" ? { max_length: 2000 } : {}),
    ...options.schema,
  },
  meta: {
    interface:
      type === "json"
        ? "input-code"
        : type === "text"
          ? "input-multiline"
          : "input",
    ...options.meta,
  },
});
const definitions = {
  site_pages: {
    icon: "web",
    label: "Páginas del sitio",
    fields: [
      field("path"),
      field("locale"),
      field("title"),
      field("catalog", "json"),
      field("draft", "json"),
      field("revision", "integer", { schema: { default_value: 1 } }),
    ],
  },
  site_releases: {
    icon: "published_with_changes",
    label: "Publicaciones del sitio",
    fields: [
      field("snapshot", "json"),
      field("status"),
      field("author"),
      field("created", "timestamp"),
    ],
  },
  site_settings: {
    icon: "settings",
    label: "Ajustes del sitio",
    fields: [field("active_release"), field("program", "json")],
  },
  site_posts: {
    icon: "article",
    label: "Artículos y lecturas",
    fields: ["title", "author", "category", "language", "status"]
      .map((f) => field(f))
      .concat([
        field("body", "text"),
        field("version", "integer"),
        field("updated", "timestamp"),
      ]),
  },
};
const existing = await api("/collections");
for (const [collection, definition] of Object.entries(definitions)) {
  if (!existing.some((c) => c.collection === collection))
    await api("/collections", "POST", {
      collection,
      schema: {},
      meta: {
        icon: definition.icon,
        display_template:
          collection === "site_pages" ? "{{locale}} · {{title}}" : "{{id}}",
        translations: [{ language: "es-ES", translation: definition.label }],
      },
      fields: [
        field("id", "string", {
          schema: { is_primary_key: true, is_nullable: false, max_length: 100 },
          meta: { hidden: true },
        }),
        ...definition.fields,
      ],
    });
  else {
    const current = await api(`/fields/${collection}`);
    for (const f of definition.fields)
      if (!current.some((c) => c.field === f.field))
        await api(`/fields/${collection}`, "POST", f);
  }
}
let pages = await api("/items/site_pages?limit=-1");
let created = 0;
for (const record of seed.pages) {
  if (!pages.some((p) => p.id === record.id)) {
    await api("/items/site_pages", "POST", record);
    created++;
  } else
    await api("/items/site_pages/" + record.id, "PATCH", {
      catalog: record.catalog,
      title: record.title,
    });
}
const settings = await api("/items/site_settings?limit=-1");
if (!settings.some((r) => r.id === "neurodiversa"))
  await api("/items/site_settings", "POST", {
    id: "neurodiversa",
    program: seed.program || null,
  });
const posts = await api("/items/site_posts?limit=-1");
for (const record of seed.posts || [])
  if (!posts.some((p) => p.id === record.id))
    await api("/items/site_posts", "POST", record);
let policy = (await api("/policies?limit=-1")).find(
  (p) => p.name === "Neuro Diversa Studio API",
);
if (!policy)
  policy = await api("/policies", "POST", {
    name: "Neuro Diversa Studio API",
    app_access: false,
    admin_access: false,
  });
let role = (await api("/roles?limit=-1")).find(
  (r) => r.name === "Neuro Diversa Studio API",
);
if (!role)
  role = await api("/roles", "POST", {
    name: "Neuro Diversa Studio API",
    icon: "api",
  });
const access = await api("/access?limit=-1");
if (
  !access.some(
    (a) =>
      (typeof a.role === "object" ? a.role?.id : a.role) === role.id &&
      (typeof a.policy === "object" ? a.policy?.id : a.policy) === policy.id,
  )
)
  await api("/access", "POST", { role: role.id, policy: policy.id });
const permissions = await api("/permissions?limit=-1");
for (const collection of [
  ...Object.keys(definitions),
  "directus_files",
  "directus_folders",
])
  for (const action of collection === "directus_files"
    ? ["read", "create"]
    : collection === "directus_folders"
      ? ["read"]
      : ["read", "create", "update", "delete"])
    if (
      !permissions.some(
        (p) =>
          (typeof p.policy === "object" ? p.policy?.id : p.policy) ===
            policy.id &&
          p.collection === collection &&
          p.action === action,
      )
    )
      await api("/permissions", "POST", {
        policy: policy.id,
        collection,
        action,
        permissions: {},
        validation: {},
        presets: {},
        fields: ["*"],
      });
let service = (
  await api(
    "/users?filter[email][_eq]=studio-api@neurodiversa.mx&fields=id,email",
  )
).at(0);
if (!service)
  service = await api("/users", "POST", {
    email: "studio-api@neurodiversa.mx",
    password: seed.servicePassword,
    first_name: "Neuro Diversa Studio",
    role: role.id,
    status: "active",
    token: seed.serviceToken,
  });
else
  await api(`/users/${service.id}`, "PATCH", {
    token: seed.serviceToken,
    role: role.id,
  });
const current = await api("/items/site_settings/neurodiversa");
if (!current.active_release) {
  pages = await api("/items/site_pages?limit=-1");
  const id = crypto.randomUUID(),
    snapshot = Object.fromEntries(
      pages.map((p) => [
        p.id,
        {
          values: p.draft?.values || {},
          seo: p.draft?.seo || {},
          sections: p.draft?.sections || {},
          revision: p.revision,
        },
      ]),
    );
  await api("/items/site_releases", "POST", {
    id,
    snapshot,
    status: "published",
    author: "bootstrap",
    created: new Date().toISOString(),
  });
  await api("/items/site_settings/neurodiversa", "PATCH", {
    active_release: id,
  });
}
await api("/settings", "PATCH", {
  project_name: "Neuro Diversa",
  project_color: "#87424d",
  project_url: "https://neurodiversa.mx",
  default_language: "es-ES",
});
console.log(
  JSON.stringify({
    site: "neurodiversa",
    createdPages: created,
    serviceConfigured: true,
    postsImported: (seed.posts || []).length,
  }),
);
