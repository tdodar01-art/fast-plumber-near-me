/**
 * Brevo transactional email sender (Node/CommonJS).
 *
 * Mirrors the TS pattern at ~/code/handyman/handyman-intake/lib/brevo.ts and
 * the Sarah-v3 scripts that send through the AOK Brevo account. Auth header
 * is `api-key` (not Authorization: Bearer) — that's Brevo's convention.
 *
 * Required env vars:
 *   BREVO_API_KEY         — full Brevo transactional API key
 *   BREVO_SENDER_EMAIL    — already-verified sender address on the Brevo
 *                            account (for fast-plumber: an AOK domain is
 *                            acceptable for v0 per delta 023 — see
 *                            control-center playbook-deltas/023)
 * Optional:
 *   BREVO_SENDER_NAME     — display name (default "Fast Plumber Pipeline")
 */

async function sendBrevoEmail({ to, subject, htmlContent, textContent }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Fast Plumber Pipeline";

  if (!apiKey || !senderEmail) {
    return {
      ok: false,
      error: `Brevo not configured (apiKey=${!!apiKey}, sender=${!!senderEmail})`,
    };
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map((r) => (typeof r === "string" ? { email: r } : r))
    .filter((r) => r && typeof r.email === "string" && r.email.length > 0);

  if (recipients.length === 0) {
    return { ok: false, error: "no valid recipients" };
  }

  const body = {
    sender: { email: senderEmail, name: senderName },
    to: recipients,
    subject,
    htmlContent,
  };
  if (typeof textContent === "string" && textContent.length > 0) {
    body.textContent = textContent;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Brevo ${res.status}: ${text.substring(0, 400)}`,
      };
    }

    const data = await res.json();
    return { ok: true, messageId: data?.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = { sendBrevoEmail, escapeHtml };
