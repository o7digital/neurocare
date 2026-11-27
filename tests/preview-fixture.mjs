// Isolated browser QA only. Never included in a Vercel deployment or backend image.
import { fixtureCms } from "./cms-fixture.mjs";
import { createApplication } from "../backend/server.mjs";
if (process.env.NEURODIVERSA_QA !== "1")
  throw new Error("Explicit isolated QA mode required");
const app = await createApplication(
  {
    SITE_URL: "http://127.0.0.1:4328",
    PUBLIC_SITE_URL: "https://neurodiversa.mx",
    GATEWAY_KEY: "local-qa-gateway-".repeat(3),
    AUTH_SECRET: "local-qa-auth-".repeat(3),
    VAULT_KEY: "local-qa-vault-".repeat(3),
    DB_PATH: ":memory:",
    SITE_UPLOAD_DIR: "/tmp/neurodiversa-qa-video-uploads",
    SITE_BUNDLE_DIR: new URL("../dist/_studio/pages", import.meta.url).pathname,
    SITE_STATIC_DIR: new URL("../dist", import.meta.url).pathname,
  },
  {
    disableWorker: true,
    cms: (await fixtureCms()).cms,
    providers: {
      health: async () => "3.6.0",
      assist: async (transcript, language, task) => ({
        text:
          task === "summary"
            ? "Solicitud de información sobre el grupo. Confirmar detalles con el equipo."
            : "Hola, gracias por tu interés. El equipo confirmará contigo los detalles del grupo.",
      }),
      chat: async () => ({
        answer:
          "El grupo de habilidades sociales es para jóvenes adultos de 18 a 35 años. Puedes dejar tus datos en el formulario para que el equipo confirme los detalles.",
        conversation_id: "b".repeat(24),
      }),
      bufferChannels: async () => ({
        organization: { id: "qa", name: "Cuenta QA" },
        channels: [
          { id: "qa-facebook", name: "Neuro Diversa QA", service: "facebook" },
        ],
      }),
      bufferPosts: async () => ({
        posts: {
          "qa-post": { status: "draft", text: "Texto de prueba aislado." },
        },
      }),
      mailchimpPing: async () => ({ ok: true }),
      mailchimpDraft: async (config, campaign, onCreated) => {
        onCreated("qa-mc");
        return { id: "qa-mc" };
      },
      bufferPost: async () => ({ id: "qa-post" }),
      sendMail: async () => ({ messageId: "qa-message" }),
      unsubscribe: (id) => id + ".qa",
    },
  },
);
const { user } = await app.auth.api.signUpEmail({
  body: {
    name: "Revisión QA",
    email: "reviewer@example.test",
    password: "Neurodiversa-QA-only-2026!",
  },
});
app.store.db.prepare("INSERT INTO members VALUES (?,?)").run(user.id, "owner");
const { user: editorUser } = await app.auth.api.signUpEmail({
  body: {
    name: "Editor QA",
    email: "editor@example.test",
    password: "Neurodiversa-QA-only-2026!",
  },
});
app.store.db
  .prepare("INSERT INTO members VALUES (?,?)")
  .run(editorUser.id, "editor");
app.server.listen(4399, "127.0.0.1", () =>
  console.log("Isolated Neuro Diversa QA backend: http://127.0.0.1:4399"),
);
process.on("SIGTERM", () => {
  app.close();
  process.exit();
});
