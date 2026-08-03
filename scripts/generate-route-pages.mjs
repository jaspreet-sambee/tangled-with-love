import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "assets", "js", "store-data.js");
const source = await readFile(catalogPath, "utf8");

const startMarker = "const CATEGORIES = ";
const start = source.indexOf(startMarker);
const endPatterns = [
  /\r?\n\r?\n\/\* =+\r?\n {3}REVIEWS/,
  /\r?\n\r?\n\/\* =+\r?\n {3}STATE/,
];
const endCandidates = endPatterns
  .map(pattern => {
    if (start < 0) return -1;
    const match = source.slice(start).match(pattern);
    return match ? start + match.index : -1;
  })
  .filter(index => index >= 0);
const end = endCandidates.length ? Math.min(...endCandidates) : -1;

if (start < 0 || end < 0) {
  throw new Error("Could not locate CATEGORIES in assets/js/store-data.js");
}

const literal = source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
const categories = Function(`"use strict"; return (${literal});`)();
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const routes = new Set([
  "/shop",
  "/about",
  "/reviews",
  "/faq",
  "/contact",
  "/contacts",
  "/collections",
  "/checkout/success",
  "/checkout/cancel",
  "/custom-order",
]);

for (const category of categories) {
  routes.add(`/collections/${slug(category.id)}`);
  for (const variant of category.variants) routes.add(`/products/${slug(variant.id)}`);
}

const routePage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Opening Tangled with Love…</title>
</head>
<body>
  <script>
    (() => {
      const cleanPath = location.pathname === "/" ? "/" : location.pathname.replace(/\\/+$/, "");
      const route = cleanPath + location.search + location.hash;
      location.replace("/?__route=" + encodeURIComponent(route));
    })();
  </script>
  <noscript><p>Please enable JavaScript and return to <a href="/">Tangled with Love</a>.</p></noscript>
</body>
</html>
`;

for (const route of [...routes].sort()) {
  const relativeRoute = route.replace(/^\/+/, "");
  const outputPath = join(root, relativeRoute, "index.html");
  if (!outputPath.startsWith(root + sep)) throw new Error(`Unsafe route: ${route}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, routePage);
}

console.log(`Generated ${routes.size} static route pages.`);
