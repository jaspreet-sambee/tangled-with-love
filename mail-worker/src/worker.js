/**
 * Cloudflare Worker — sends contact-form / reference-photo emails (with attachments)
 * for tangledwithlove.com via Resend.
 *
 * The static site POSTs multipart/form-data here (name/email/phone/interest/message
 * plus optional file attachments). This Worker builds the same branded HTML used by
 * the EmailJS templates and sends via Resend's API: one email to the shop owner
 * (with attachments, if any) and — when a customer email is provided — a confirmation
 * copy to the customer (no attachments).
 *
 * This exists only for the attachment path. Plain messages/orders without files still
 * go through EmailJS directly from the browser (see index.html) — unaffected by this.
 *
 * Deploy:
 *   1. `npm install -g wrangler` (skip if already installed for stripe-worker)
 *   2. `cd mail-worker && wrangler login`
 *   3. Add your Resend API key:
 *        wrangler secret put RESEND_API_KEY
 *   4. Set ALLOWED_ORIGIN, OWNER_EMAIL and FROM_EMAIL in wrangler.toml
 *      (FROM_EMAIL's domain must be verified in Resend — see README notes)
 *   5. `wrangler deploy`
 *   6. Copy the resulting worker URL into index.html's CONFIG.MAIL_WORKER_ENDPOINT.
 */

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

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
    if (!env.RESEND_API_KEY) {
      return json({ error: "Server is not configured (missing RESEND_API_KEY)." }, 500, cors);
    }

    let form;
    try { form = await request.formData(); } catch { return json({ error: "Invalid form data" }, 400, cors); }

    const formType = String(form.get("form_type") || "message").trim() || "message";
    const fromName = String(form.get("from_name") || "").trim() || "Website visitor";
    const replyTo = String(form.get("reply_to") || "").trim();
    const phone = String(form.get("phone") || "").trim() || "—";
    const interest = String(form.get("interest") || "").trim() || "—";
    const message = String(form.get("message") || "").trim();

    const files = form.getAll("attachments").filter(f => f && typeof f.arrayBuffer === "function" && f.size > 0);
    if (!message && !files.length) {
      return json({ error: "Nothing to send." }, 400, cors);
    }
    if (files.length > MAX_FILES) {
      return json({ error: `Too many files (max ${MAX_FILES}).` }, 400, cors);
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return json({ error: "Attachments too large (max 15MB total)." }, 400, cors);
    }

    const attachments = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      attachments.push({ filename: f.name || "attachment", content: arrayBufferToBase64(buf) });
    }

    const ownerEmail = env.OWNER_EMAIL || "hello@tangledwithlove.com";
    const fromEmail = env.FROM_EMAIL;
    if (!fromEmail) {
      return json({ error: "Server is not configured (missing FROM_EMAIL)." }, 500, cors);
    }

    const ownerSubject = formType === "order"
      ? `Reference photos — order via tangledwithlove.com`
      : formType === "review"
      ? `⭐ New review from ${fromName} — Tangled with Love`
      : `New message from ${fromName} — Tangled with Love`;

    try {
      await sendResend(env.RESEND_API_KEY, {
        from: fromEmail,
        to: [ownerEmail],
        reply_to: replyTo || undefined,
        subject: ownerSubject,
        html: ownerTemplate({ formType, fromName, replyTo, phone, interest, message }),
        attachments: attachments.length ? attachments : undefined,
      });

      if (replyTo) {
        await sendResend(env.RESEND_API_KEY, {
          from: fromEmail,
          to: [replyTo],
          subject: "We received your message 🧶",
          html: customerTemplate({ fromName, formType, message }),
        });
      }
    } catch (err) {
      return json({ error: "Failed to send email", details: String(err && err.message || err) }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

async function sendResend(apiKey, payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "tangled-mail-worker/1.0",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  return res.json();
}

function arrayBufferToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ownerTemplate({ formType, fromName, replyTo, phone, interest, message }) {
  const isReview = formType === "review";
  return `
<div style="font-family:Georgia,serif;background:#FBF6EC;padding:32px;max-width:600px;margin:auto;border-radius:12px;color:#2C1A0E;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:22px;font-weight:700;color:#7C5035;letter-spacing:0.05em;">🧶 TANGLED WITH LOVE</div>
    <div style="font-size:13px;color:#B08860;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">${isReview ? "⭐ New Customer Review" : "New Website Submission"}</div>
  </div>
  <div style="background:#F2E4D4;border-radius:10px;padding:20px 24px;">
    <p style="margin:0 0 12px;"><strong style="color:#7C5035;">Type:</strong> <span style="text-transform:capitalize;">${esc(formType)}</span></p>
    <p style="margin:0 0 12px;"><strong style="color:#7C5035;">Name:</strong> ${esc(fromName)}</p>
    <p style="margin:0 0 12px;"><strong style="color:#7C5035;">Email:</strong> ${esc(replyTo || "—")}</p>
    <p style="margin:0 0 12px;"><strong style="color:#7C5035;">Phone:</strong> ${esc(phone)}</p>
    <p style="margin:0 0 12px;"><strong style="color:#7C5035;">Interested in:</strong> ${esc(interest)}</p>
    <p style="margin:0;"><strong style="color:#7C5035;">${isReview ? "Review:" : "Message:"}</strong><br>${esc(message).replace(/\n/g, "<br>")}</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#B08860;margin-top:24px;">Sent automatically from tangledwithlove.com</p>
</div>`;
}

function customerTemplate({ fromName, formType, message }) {
  return `
<div style="font-family:Georgia,serif;background:#FBF6EC;padding:32px;max-width:600px;margin:auto;border-radius:12px;color:#2C1A0E;text-align:center;">
  <div style="font-size:22px;font-weight:700;color:#7C5035;letter-spacing:0.05em;">🧶 TANGLED WITH LOVE</div>
  <p style="font-size:16px;margin:24px 0 8px;">Hi ${esc(fromName)},</p>
  <p style="font-size:15px;line-height:1.6;color:#7A5230;">Thank you! We've received your ${esc(formType)} and will get back to you within 1–2 days.</p>
  <div style="background:#F2E4D4;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:left;">
    <p style="margin:0;font-size:14px;color:#7C5035;"><strong>Your message:</strong><br>${esc(message).replace(/\n/g, "<br>")}</p>
  </div>
  <p style="font-size:13px;color:#B08860;">— Made with love, one stitch at a time</p>
</div>`;
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}
