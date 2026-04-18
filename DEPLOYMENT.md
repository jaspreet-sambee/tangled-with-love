# Tangled with Love — Deployment Guide

This is everything you need to go live at **tangledwithlove.com** with real Stripe payments and a working contact form. Total time: about **45–60 min** the first time, free forever after.

Stack:

- **Static site** on GitHub Pages (already set up)
- **Stripe Checkout** for payments (hosted checkout, PCI-compliant)
- **Cloudflare Worker** (tiny serverless function) to create Stripe sessions securely
- **Formspree** for the contact form

---

## Step 1 — Make a Stripe account

1. Go to https://dashboard.stripe.com/register
2. Create an account for **Tangled with Love**. Use the email `hello@tangledwithlove.com` if you've set that up, otherwise your personal email.
3. Activate the account by providing business info (sole proprietor works fine). Stripe will ask for:
   - Legal name & address
   - A Canadian bank account (for payouts)
   - Last 4 of SIN (for tax reporting)
4. Once activated, go to **Developers → API keys**. You'll see:
   - **Publishable key** — starts with `pk_live_…`
   - **Secret key** — starts with `sk_live_…` (click *Reveal live key*)

Keep these safe. The **secret key must never go into the website code or GitHub** — it stays in Cloudflare.

> Tip: Until your bank account is verified you can use `pk_test_` / `sk_test_` keys for end-to-end testing. Stripe provides test cards like `4242 4242 4242 4242`.

---

## Step 2 — Deploy the Cloudflare Worker (Stripe session creator)

The worker lives in `stripe-worker/`. It's ~100 lines of JS that receives your cart, calls Stripe securely, and returns the Checkout URL.

### 2a. Create a Cloudflare account
Go to https://dash.cloudflare.com/sign-up — free tier is plenty (100,000 requests/day).

### 2b. Install Wrangler and log in

```bash
npm install -g wrangler
cd stripe-worker
wrangler login    # opens a browser tab to authorize
```

### 2c. Add your Stripe secret key as a Cloudflare secret

```bash
wrangler secret put STRIPE_SECRET_KEY
```

Paste your `sk_live_…` (or `sk_test_…`) when prompted. It's encrypted and only visible to the worker.

### 2d. Edit `wrangler.toml`

Open `stripe-worker/wrangler.toml`. Set `ALLOWED_ORIGIN` to your site URL(s):

```toml
[vars]
ALLOWED_ORIGIN = "https://tangledwithlove.com"
```

(Add `http://localhost:8080` too if you want to test locally.)

### 2e. Deploy

```bash
wrangler deploy
```

You'll see something like:
```
✨ Deployed to https://tangled-stripe.YOURNAME.workers.dev
```

**Copy that URL** — you'll paste it into the website in Step 4.

---

## Step 3 — Set up the contact form (Formspree)

1. Go to https://formspree.io and sign up (free tier = 50 submissions/month).
2. Click **New Form**, name it "Tangled with Love Contact".
3. Set the target email to `hello@tangledwithlove.com` (or your email).
4. Copy the form ID — it looks like `xrgdqpzw` in a URL like `https://formspree.io/f/xrgdqpzw`.

---

## Step 4 — Wire everything into `index.html`

Open `index.html` and find the `CONFIG` block near the bottom (search for `STRIPE_CHECKOUT_ENDPOINT`).

```js
const CONFIG = {
  STRIPE_CHECKOUT_ENDPOINT: "https://tangled-stripe.YOURNAME.workers.dev",
  STRIPE_PUBLISHABLE_KEY:   "pk_live_...",
  FORMSPREE_ID:             "xrgdqpzw",   // your Formspree form ID
  CURRENCY: "CAD",
  CURRENCY_SYMBOL: "CA$",
};
```

Commit & push.

---

## Step 5 — Push to GitHub Pages

If this repo is already connected to GitHub Pages (the `CNAME` file and git history suggest yes):

```bash
git add .
git commit -m "Launch: full shop with Stripe checkout"
git push
```

GitHub Pages rebuilds in about 60 seconds.

### First-time GitHub Pages setup (only if needed)
1. Push the `tangled-with-love/` folder to a repo on GitHub.
2. Repo **Settings → Pages** → Source = `main` branch, `/` root.
3. Custom domain: `tangledwithlove.com`. Enable "Enforce HTTPS".
4. In your domain registrar (e.g., Namecheap / GoDaddy / Cloudflare DNS), point the domain:
   - `A` record → `185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153`
   - `CNAME` record for `www` → `YOUR-GITHUB-USERNAME.github.io`

---

## Step 6 — Test end-to-end

1. Visit https://tangledwithlove.com
2. Browse shop → pick a bag → add to cart
3. Open cart → click **Secure checkout**
4. You should be redirected to Stripe's hosted checkout page showing your line items
5. Pay with test card `4242 4242 4242 4242` (any future date, any CVC, any postcode) if you're in test mode
6. You should land back on `/?checkout=success` with an order ID
7. Check the Stripe dashboard — the payment appears under **Payments**

Also test:
- Contact form on the home page — should arrive in your Formspree inbox → your email
- The mobile view (resize browser to <640px)

---

## Step 7 — Go live

When ready for real money:

1. In `CONFIG`, replace `pk_test_…` with `pk_live_…`
2. In Cloudflare, re-run `wrangler secret put STRIPE_SECRET_KEY` and paste `sk_live_…`
3. Test one real purchase with your own card (you can refund yourself in Stripe)
4. Announce on Instagram @mummawarmth 🧶

---

## Editing the shop later

Everything is data-driven. To change prices, product names, or add new variants, edit the `CATEGORIES` array in `index.html` and push.

- **New bag variant**: add a folder under `assets/products/CATEGORY/NEW-VARIANT-ID/` with numbered images (`1.jpg`, `2.jpg`, …), add an entry to `CATEGORIES[i].variants`, and update `IMAGE_MAP` (just copy an existing entry as a template).
- **New category**: add an object to `CATEGORIES` with a matching `assets/products/CATEGORY-ID/` folder.
- **Change prices**: just edit the `price` field (it's in whole dollars).

## Money & fees

- Stripe charges **2.9% + 30¢** per successful CAD card charge
- Cloudflare Workers: free for < 100k req/day (you'll never hit this)
- GitHub Pages: free
- Formspree: free for < 50 submissions/month

## Troubleshooting

**"Checkout session failed" alert** — Check the browser console. Most common causes:
- `STRIPE_CHECKOUT_ENDPOINT` wrong in `index.html`
- `ALLOWED_ORIGIN` in Cloudflare doesn't include your site URL
- `STRIPE_SECRET_KEY` not set (run `wrangler secret list` to verify)

**Contact form silently fails** — `FORMSPREE_ID` not set correctly. Open browser DevTools → Network tab → submit form → check the response.

**Images don't load** — Confirm the `assets/products/` folder was committed. Run `git status` before pushing.

**Domain doesn't work after DNS change** — DNS can take up to 24 hours to propagate globally. Try https://dnschecker.org to see the state worldwide.

---

If you need anything else, email Stripe support or me. 🧶
