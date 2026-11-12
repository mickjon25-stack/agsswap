import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/email/send";

export const runtime = "nodejs";

async function unsubscribe(url: URL) {
  const t = url.searchParams.get("t") || "";
  const type = url.searchParams.get("type");
  if (!/^[0-9a-f-]{36}$/i.test(t) || (type !== "messages" && type !== "looking_for")) return false;
  const col = type === "messages" ? "message_alerts" : "looking_for_alerts";
  const { data } = await createServiceClient()
    .from("notification_prefs")
    .update({ [col]: false, updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", t)
    .select("user_id");
  return Boolean(data?.length);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ok = await unsubscribe(url);
  const what = url.searchParams.get("type") === "messages" ? "message and offer" : "'Looking for'";
  const body = ok
    ? `You won't get ${what} emails anymore. You can turn them back on anytime.`
    : "That link didn't work. You can change your email settings in your account.";
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgsSwap email settings</title></head><body style="font-family:Arial,sans-serif;background:#eef2ea;color:#1f1a14;padding:40px 16px;text-align:center"><div style="max-width:440px;margin:0 auto;background:#fffdf9;border:1px solid #d5e0d4;border-radius:16px;padding:24px"><img src="/logo-64.png" width="48" height="48" alt="AgsSwap"><h2 style="color:#1e4a35">${ok ? "You're unsubscribed" : "Hmm"}</h2><p>${body}</p><p><a href="${appUrl()}/alerts" style="color:#8b3a2a;font-weight:bold">Manage email alerts</a></p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/** One-click unsubscribe (RFC 8058) from mail apps. */
export async function POST(req: Request) {
  await unsubscribe(new URL(req.url));
  return new NextResponse(null, { status: 200 });
}
