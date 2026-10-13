import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const withinRoot = (relative) => {
  const target = resolve(root, relative);
  if (!target.startsWith(`${root}${sep}`)) throw new Error(`Unsafe path: ${relative}`);
  return target;
};

const builtHtml = withinRoot("dist/dev.html");
const builtAssets = withinRoot("dist/assets");
const publishedHtml = withinRoot("index.html");
const publishedAssets = withinRoot("assets");

await writeFile(publishedHtml, await readFile(builtHtml));
await rm(publishedAssets, { recursive: true, force: true });
await mkdir(publishedAssets, { recursive: true });
await cp(builtAssets, publishedAssets, { recursive: true, filter: (source) => !source.endsWith(".map") });
console.log("GitHub Pages files ready in the repository root.");
