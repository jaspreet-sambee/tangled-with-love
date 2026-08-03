# Tangled with Love

The online shop for Mum's handcrafted crochet bags — live at **[tangledwithlove.com](https://tangledwithlove.com)**.

## Stack

- **Static storefront** (semantic HTML, cacheable CSS/JS, no framework runtime) — hosted on GitHub Pages
- **Stripe Checkout** for payments via a tiny Cloudflare Worker
- **EmailJS / mail Worker** for contact messages and reference-photo attachments
- **Node maintenance scripts** for routes, thumbnails, and catalog validation

## Structure

```
tangled-with-love/
├── index.html              # Semantic page shell and storefront content
├── 404.html                # GitHub Pages fallback for clean storefront routes
├── scripts/                # Route, thumbnail, and validation tools
├── package.json            # Repeatable maintenance commands
├── shop/, faq/, products/  # Generated route entry pages
├── CNAME                   # tangledwithlove.com
├── DEPLOYMENT.md           # Step-by-step deployment guide
├── assets/
│   ├── brand/               # Logo, favicon, and touch icon assets
│   ├── css/storefront.css  # Theme, layout, responsive and accessible states
│   ├── js/store-data.js    # Configuration, products, reviews, and image map
│   ├── js/storefront.js    # Navigation, cart, search, saved items, and checkout
│   ├── products/           # Full-resolution product galleries
│   └── thumbs/             # Optimized WebP browsing images
├── stripe-worker/          # Secure Stripe session creation
└── mail-worker/            # Contact and attachment delivery
```

## First-time setup

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — 45 minutes, free forever.

## Editing products

Open `assets/js/store-data.js` and find the `CATEGORIES` array. Each variant has:

```js
{ id: "cherry-blossom", name: "...", price: 50, heroIdx: 0, desc: "..." }
```

Images live at `assets/products/{categoryId}/{variantId}/{1..N}.{ext}` and are listed in `IMAGE_MAP` in the same data file.

After adding or changing product photos, refresh the lightweight browsing images:

```bash
npm ci
npm run build
```

This requires Node.js 20.9 or newer. `npm run build` regenerates clean routes and thumbnails, then verifies every product, price, image, route, script, and required DOM reference.

## Local dev

You can double-click `index.html` for a quick offline preview; product photos and
navigation work directly from the downloaded folder. For production-like HTTP
testing, run:

```bash
python3 -m http.server 8080
# visit http://localhost:8080
```

Production navigation uses clean URLs such as `/shop`, `/faq`, `/contacts`,
`/collections/round-patches`, and `/products/cherry-blossom`. Their generated
entry pages make direct visits work on GitHub Pages and the local server.

For a fast code/data check without regenerating images:

```bash
npm run validate
```

Keep `404.html` as a fallback for older or mistyped links.

Made with love for Mum. 🧶
