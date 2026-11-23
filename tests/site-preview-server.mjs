// Local built-site server for Firefox verification. No deployment or live service calls.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
if (process.env.NEURODIVERSA_QA !== "1")
  throw new Error("Isolated QA required");
process.env.NEURODIVERSA_BACKEND_URL = "http://127.0.0.1:4399";
process.env.NEURODIVERSA_GATEWAY_KEY = "local-qa-gateway-".repeat(3);
const { default: render } = await import("../api/render.mjs"),
  root = resolve("dist"),
  mimes = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".json": "application/json",
    ".html": "text/html",
  };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4328");
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const upstream = await fetch("http://127.0.0.1:4399" + req.url, {
        method: req.method,
        headers: {
          ...req.headers,
          host: "127.0.0.1:4399",
          "x-neurodiversa-key": process.env.NEURODIVERSA_GATEWAY_KEY,
        },
        ...(body.length ? { body } : {}),
        redirect: "manual",
      });
      res.statusCode = upstream.status;
      for (const [k, v] of upstream.headers)
        if (
          ![
            "set-cookie",
            "content-length",
            "content-encoding",
            "transfer-encoding",
            "connection",
          ].includes(k)
        )
          res.setHeader(k, v);
      if (upstream.headers.getSetCookie().length)
        res.setHeader("set-cookie", upstream.headers.getSetCookie());
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + "/") && file !== root)
      throw new Error("Invalid path");
    let path = file;
    try {
      if ((await stat(path)).isDirectory()) path += "/index.html";
    } catch {}
    if (
      path.endsWith(".html") &&
      !/^\/(?:admin|estudio|inbox)\//.test(url.pathname)
    ) {
      req.query = { page: url.pathname };
      await render(req, res);
      return;
    }
    const bytes = await readFile(path);
    res.setHeader(
      "Content-Type",
      mimes[extname(path)] || "application/octet-stream",
    );
    res.end(bytes);
  } catch (error) {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(4328, "127.0.0.1", () =>
  console.log("Isolated built site: http://127.0.0.1:4328"),
);
