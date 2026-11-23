import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeBundle } from "./site-engine.mjs";
import { copyFile } from "node:fs/promises";
const root = "dist",
  bundles = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !["_astro", "_studio", "admin", "estudio", "inbox"].includes(entry.name)
    )
      await visit(file);
    else if (entry.isFile() && entry.name === "index.html") {
      const path = "/" + dir.slice(root.length).replace(/^\//, "");
      bundles.push(makeBundle(await readFile(file, "utf8"), path));
    }
  }
}
await copyFile("cms/site-engine.mjs", "backend/site-engine.mjs");
await visit(root);
await mkdir("dist/_studio/pages", { recursive: true });
for (const bundle of bundles)
  await writeFile(
    `dist/_studio/pages/${bundle.id}.json`,
    JSON.stringify(bundle),
  );
await writeFile(
  "dist/_studio/catalog.json",
  JSON.stringify(bundles.map(({ html, ...data }) => data)),
);
console.log(
  `Site Studio: ${bundles.length} actual pages mapped for visual editing.`,
);
