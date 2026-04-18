/**
 * Cloudflare Worker — Stripe Checkout session creator for tangledwithlove.com
 *
 * The static GitHub-Pages site posts { currency, items, success_url, cancel_url }
 * here. This Worker calls Stripe's REST API with the secret key stored in
 * Cloudflare env vars and returns { url } for the frontend to redirect to.
 *
 * Deploy:
 *   1. `npm install -g wrangler`
 *   2. `cd stripe-worker && wrangler login`
 *   3. Add your Stripe secret key:
 *        wrangler secret put STRIPE_SECRET_KEY
 *      (paste sk_live_... or sk_test_... when prompted)
 *   4. Set ALLOWED_ORIGIN in wrangler.toml to your site URL
 *   5. `wrangler deploy`
 *   6. Copy the resulting worker URL into index.html's CONFIG.STRIPE_CHECKOUT_ENDPOINT.
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map(s => s.trim());
    const corsOrigin = allowed.includes("*") || allowed.includes(origin) ? origin : allowed[0];

    const cors = {
      "Access-Control-Allow-Origin": corsOrigin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }
    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Server is not configured (missing STRIPE_SECRET_KEY)." }, 500, cors);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }

    const { currency = "cad", items, success_url, cancel_url } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "Cart is empty." }, 400, cors);
    }
    if (!success_url || !cancel_url) {
      return json({ error: "Missing success/cancel URLs." }, 400, cors);
    }
    for (const it of items) {
      if (!it.name || typeof it.amount_cents !== "number" || it.amount_cents < 50) {
        return json({ error: "Invalid line item." }, 400, cors);
      }
    }

    // Build Stripe form-encoded params for /v1/checkout/sessions
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", success_url.replace(/\?.*$/, "") + "?checkout=success&session_id={CHECKOUT_SESSION_ID}");
    params.append("cancel_url",  cancel_url);
    params.append("billing_address_collection", "required");
    // Collect shipping — Canada + common intl destinations
    ["CA","US","GB","AU","NZ","IE","DE","FR","NL","IN"].forEach((c, i) => {
      params.append(`shipping_address_collection[allowed_countries][${i}]`, c);
    });

    // Shipping options — a simple flat-rate setup
    // Canada: $8, International: $25
    params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "800");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", currency);
    params.append("shipping_options[0][shipping_rate_data][display_name]", "Canada — standard");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "3");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "7");

    params.append("shipping_options[1][shipping_rate_data][type]", "fixed_amount");
    params.append("shipping_options[1][shipping_rate_data][fixed_amount][amount]", "2500");
    params.append("shipping_options[1][shipping_rate_data][fixed_amount][currency]", currency);
    params.append("shipping_options[1][shipping_rate_data][display_name]", "International — standard");
    params.append("shipping_options[1][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    params.append("shipping_options[1][shipping_rate_data][delivery_estimate][minimum][value]", "7");
    params.append("shipping_options[1][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    params.append("shipping_options[1][shipping_rate_data][delivery_estimate][maximum][value]", "21");

    // Line items
    items.forEach((it, i) => {
      params.append(`line_items[${i}][price_data][currency]`, currency);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(it.amount_cents));
      params.append(`line_items[${i}][price_data][product_data][name]`, String(it.name).slice(0, 250));
      if (it.image) {
        params.append(`line_items[${i}][price_data][product_data][images][0]`, String(it.image));
      }
      params.append(`line_items[${i}][quantity]`, String(Math.max(1, it.quantity || 1)));
    });

    // Turn on automatic tax (off by default — enable after setting up Stripe Tax)
    // params.append("automatic_tax[enabled]", "true");

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      return json({ error: (data.error && data.error.message) || "Stripe error", details: data }, 502, cors);
    }
    return json({ url: data.url, id: data.id }, 200, cors);
  },
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}
