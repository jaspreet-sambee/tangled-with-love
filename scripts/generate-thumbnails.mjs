import { createRequire } from "node:module";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  throw new Error("The image optimizer needs Sharp. Run `npm install`, then retry.");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "assets", "js", "store-data.js"), "utf8");
const categoriesStartMarker = "const CATEGORIES = ";
const categoriesStart = source.indexOf(categoriesStartMarker);
const categoryEndMarkers = [
  "\n\n/* =====================================================================\n   REVIEWS",
  "\n\n/* =====================================================================\n   STATE",
];
const categoriesEnd = Math.min(...categoryEndMarkers
  .map(marker => source.indexOf(marker, categoriesStart))
  .filter(index => index >= 0));

if (categoriesStart < 0 || !Number.isFinite(categoriesEnd)) {
  throw new Error("Could not locate CATEGORIES in assets/js/store-data.js");
}

const categoriesLiteral = source
  .slice(categoriesStart + categoriesStartMarker.length, categoriesEnd)
  .trim()
  .replace(/;$/, "");
const categories = Function(`"use strict"; return (${categoriesLiteral});`)();

const mapStart = source.indexOf("const pngSeries =");
const mapEnd = source.indexOf("\n};", mapStart) + 3;
if (mapStart < 0 || mapEnd < 3) throw new Error("Could not locate IMAGE_MAP in assets/js/store-data.js");
const imageMap = Function(`"use strict"; ${source.slice(mapStart, mapEnd)}; return IMAGE_MAP;`)();

let originalBytes = 0;
let thumbnailBytes = 0;
let generated = 0;

for (const category of categories) {
  for (const variant of category.variants) {
    const key = `${category.id}/${variant.id}`;
    const files = imageMap[key] || [];
    if (!files.length) continue;
    const heroIndex = Math.min(Math.max(variant.heroIdx || 0, 0), files.length - 1);
    const input = join(root, "assets", "products", key, files[heroIndex]);
    const output = join(root, "assets", "thumbs", category.id, `${variant.id}.webp`);
    await mkdir(dirname(output), { recursive: true });
    await sharp(input)
      .rotate()
      .resize({ width: 720, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76, alphaQuality: 82, effort: 5, smartSubsample: true })
      .toFile(output);
    originalBytes += (await stat(input)).size;
    thumbnailBytes += (await stat(output)).size;
    generated += 1;
  }
}

const mb = bytes => (bytes / 1024 / 1024).toFixed(1);
console.log(`Generated ${generated} thumbnails: ${mb(originalBytes)} MB → ${mb(thumbnailBytes)} MB.`);
