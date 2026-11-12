
import { BRAND_URL, CONTACT_EMAIL } from "@/lib/brand";

export const FROM = "AgsSwap <hello@agsswap.com>";
export const REPLY_TO = CONTACT_EMAIL;

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || BRAND_URL).replace(/\/$/, "");
}

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Sends through Resend. Returns false (no throw) when not configured or on failure. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set; skipping send");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [opts.to],
      reply_to: REPLY_TO,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: {
        "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend error", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}
