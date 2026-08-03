# Tangled with Love

The online shop for Mum's handcrafted crochet bags — live at **[tangledwithlove.com](https://tangledwithlove.com)**.

## Stack

- **Static site** (HTML/CSS/JS, no build step) — hosted on GitHub Pages
- **Stripe Checkout** for payments via a tiny Cloudflare Worker
- **Formspree** for the contact form

## Structure

```
tangled-with-love/
├── index.html              # The whole site — single file
├── 404.html                # GitHub Pages fallback for clean storefront routes
├── scripts/                # Generates static entry pages for clean routes
├── shop/, faq/, products/  # Generated route entry pages
├── CNAME                   # tangledwithlove.com
├── DEPLOYMENT.md           # Step-by-step deployment guide
├── assets/
│   └── products/
│       ├── medium-shoulder/cherry-blossom/1.png, 2.png, ...
│       └── ... (one folder per bag variant)
└── stripe-worker/          # Cloudflare Worker for Stripe sessions
    ├── src/worker.js
    ├── wrangler.toml
    └── package.json
```

## First-time setup

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — 45 minutes, free forever.

## Editing products

Open `index.html` and find the `CATEGORIES` array. Each variant has:

```js
{ id: "cherry-blossom", name: "...", price: 65, count: 11, desc: "..." }
```

Images live at `assets/products/{categoryId}/{variantId}/{1..N}.{ext}` and are listed in the `IMAGE_MAP` object right below `CATEGORIES`.

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

After adding or renaming a product or category, regenerate those entry pages:

```bash
node scripts/generate-route-pages.mjs
```

Keep `404.html` as a fallback for older or mistyped links.

Made with love for Mum. 🧶
