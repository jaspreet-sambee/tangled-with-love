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

```bash
# Just open index.html in your browser, or:
python3 -m http.server 8080
# visit http://localhost:8080
```

Made with love for Mum. 🧶