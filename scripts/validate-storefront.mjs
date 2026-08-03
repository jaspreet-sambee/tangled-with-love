import { access, readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = relativePath => readFile(join(root, relativePath), "utf8");
const fail = message => { throw new Error(message); };

const [html, css, data, app] = await Promise.all([
  read("index.html"),
  read("assets/css/storefront.css"),
  read("assets/js/store-data.js"),
  read("assets/js/storefront.js"),
]);

for (const [name, source] of [["store-data.js", data], ["storefront.js", app]]) {
  try { Function(`"use strict";\n${source}`); }
  catch (error) { fail(`${name} has invalid JavaScript: ${error.message}`); }
}

const literalBetween = (source, startMarker, endMarker, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) fail(`Could not locate ${label}`);
  return source.slice(start + startMarker.length, end).trim().replace(/;$/, "");
};

const categoriesLiteral = literalBetween(
  data,
  "const CATEGORIES = ",
  "\n\n/* =====================================================================\n   REVIEWS",
  "CATEGORIES",
);
const categories = Function(`"use strict"; return (${categoriesLiteral});`)();

const mapStart = data.indexOf("const pngSeries =");
const mapEnd = data.indexOf("\n};", mapStart) + 3;
if (mapStart < 0 || mapEnd < 3) fail("Could not locate IMAGE_MAP");
const imageMap = Function(`"use strict"; ${data.slice(mapStart, mapEnd)}; return IMAGE_MAP;`)();

const expectedPrices = {
  "round-patches": [50, 50],
  "small-potli": [20, 30],
  "large-sized-bag": [40, 50],
  "medium-bags/round": [30, 35],
  "medium-bags/rectangle": [30, 35],
  "small-bags": [20, 30],
  "xs-bags": [15, 20],
  "leather-bags": [60, 60],
};

const productIds = new Set();
let productCount = 0;
let originalCount = 0;
let thumbnailBytes = 0;

for (const category of categories) {
  if (category.id === "rakhri-seasonal") {
    if (category.variants.length) fail("Raakhi must remain a coming-soon category without prices");
    continue;
  }
  const priceRange = expectedPrices[category.id];
  if (!priceRange) fail(`Missing price rules for ${category.id}`);
  for (const variant of category.variants) {
    productCount += 1;
    if (productIds.has(variant.id)) fail(`Duplicate product route id: ${variant.id}`);
    productIds.add(variant.id);
    if (variant.price < priceRange[0] || variant.price > priceRange[1]) {
      fail(`${category.id}/${variant.id} price ${variant.price} is outside ${priceRange.join("–")}`);
    }
    const key = `${category.id}/${variant.id}`;
    const files = imageMap[key];
    if (!Array.isArray(files) || !files.length) fail(`${key} has no product images`);
    if ((variant.heroIdx || 0) >= files.length) fail(`${key} has an invalid heroIdx`);
    for (const filename of files) {
      const imagePath = join(root, "assets", "products", key, filename);
      if (!imagePath.startsWith(root + sep)) fail(`Unsafe image path: ${key}/${filename}`);
      await access(imagePath);
      originalCount += 1;
    }
    const thumbnailPath = join(root, "assets", "thumbs", category.id, `${variant.id}.webp`);
    await access(thumbnailPath);
    thumbnailBytes += (await stat(thumbnailPath)).size;
    await access(join(root, "products", variant.id, "index.html"));
  }
}

if (productCount !== 39) fail(`Expected 39 products, found ${productCount}`);
if (Object.keys(imageMap).length !== productCount) fail("IMAGE_MAP does not match the product catalog");
if (/\b(?:alert|confirm|prompt)\s*\(/.test(app)) fail("Blocking browser dialogs are not allowed");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) fail("Duplicate HTML ids found");
const domRefs = [...new Set([...app.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]))];
const missingRefs = domRefs.filter(id => !ids.includes(id));
if (missingRefs.length) fail(`Missing DOM ids: ${missingRefs.join(", ")}`);

for (const asset of ["assets/css/storefront.css", "assets/js/store-data.js", "assets/js/storefront.js"]) {
  if (!html.includes(asset)) fail(`index.html does not load ${asset}`);
}
for (const asset of ["assets/brand/logo-mark.png", "assets/brand/logo-mark.webp", "assets/brand/maker-portrait.webp", "assets/brand/favicon-64.png", "assets/brand/apple-touch-icon.png"]) {
  await access(join(root, asset));
}
if (!html.includes('assets/brand/logo-mark.webp')) fail("The storefront brand logo is missing");
if (!html.includes('assets/brand/maker-portrait.webp')) fail("The maker portrait is missing from the animated logo");
if (!html.includes('class="nav-story-link" href="/about"')) fail("The animated logo must link to About");
if (!html.includes('class="nav-story-flip"') || !css.includes("@keyframes nav-story-flip")) fail("The logo-to-portrait flip animation is missing");
if (html.includes("Manpreet Kaur")) fail("The contact form still contains a customer name example");
if (html.includes("Custom colours welcome")) fail("Removed homepage proof text was reintroduced");
if (html.includes('id="navBack"') || app.includes('$("navBack")')) fail("The removed top back control was reintroduced");
if (/detailDispatch|estimatedDispatchWindow|Estimated dispatch/.test(`${html}\n${app}`)) fail("Estimated dispatch dates must remain removed");
if (html.includes("Handmade in Brampton")) fail("The old announcement copy was reintroduced");
if (!html.includes('id="navProgressFill"') || !app.includes('$("navProgressFill")')) fail("Navigation progress feedback is missing");
if (!html.includes('id="mainContent"')) fail("Main content landmark is missing");
if (!html.includes('class="skip-link"')) fail("Keyboard skip link is missing");
if (!css.includes(".skip-link")) fail("Skip-link styling is missing");
if ((html.match(/instagram-link/g) || []).length < 4 || !css.includes(".instagram-link::before")) fail("Instagram handle icons are missing");
for (const marker of ["hero-stitchies", "lightbox-hint", "toast-thread", "faq-icon", "cformProgressTrack", "cformProgressFill", "contactMessageCount"]) {
  if (!html.includes(marker)) fail(`Cute UX marker missing: ${marker}`);
}
for (const marker of ["cardPeekLabel", "wishlist-sparkles", "celebrateCartButton", "setupLightboxGestures", "setupFaqAccordion", "updateContactFormProgress"]) {
  if (!app.includes(marker)) fail(`Cute UX behavior missing: ${marker}`);
}
for (const marker of ["@keyframes stitchie-float", "@keyframes wishlist-spark", ".cat-swatches", ".cform-progress-card", ".cart-empty-yarn", "footer::before"]) {
  if (!css.includes(marker)) fail(`Cute UX styling missing: ${marker}`);
}
for (const controlId of ["contactName", "contactEmail", "contactPhone", "contactInterest", "contactMessage", "cformFiles"]) {
  if (!html.includes(`for="${controlId}"`)) fail(`Accessible label missing for ${controlId}`);
}
if (/<label class="sr-only" for="contact/.test(html)) fail("Contact form labels must remain visible");
if (html.includes("@emailjs/browser")) fail("EmailJS should be loaded on demand, not during initial rendering");
if (!app.includes("function loadEmailJs()")) fail("On-demand EmailJS loader is missing");

console.log(JSON.stringify({
  categories: categories.length,
  products: productCount,
  originalImages: originalCount,
  thumbnails: productCount,
  thumbnailMB: Number((thumbnailBytes / 1024 / 1024).toFixed(2)),
  htmlKB: Number((Buffer.byteLength(html) / 1024).toFixed(1)),
  cssKB: Number((Buffer.byteLength(css) / 1024).toFixed(1)),
  dataKB: Number((Buffer.byteLength(data) / 1024).toFixed(1)),
  appKB: Number((Buffer.byteLength(app) / 1024).toFixed(1)),
}, null, 2));
