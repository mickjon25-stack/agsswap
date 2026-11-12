import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { appUrl, emailEnabled, sendEmail } from "@/lib/email/send";
import { layout } from "@/lib/email/templates";
import { getEmail, getPrefs, unsubscribeUrl } from "@/lib/email/prefs";

export const runtime = "nodejs";

/**
 * Called by the sender's browser right after it inserts a message. We verify
 * the caller really just sent a message in this thread, then email the other
 * participant (max one email per thread per 15 minutes). The message text is
 * never included in the email.
 */
export async function POST(req: Request) {
  // No email provider configured (e.g. preview without Resend): nothing to do.
  // Checked first so a missing service-role key can't turn this into a 500.
  if (!emailEnabled()) return NextResponse.json({ sent: false, reason: "email not configured" });
  const { threadId } = (await req.json().catch(() => ({}))) as { threadId?: string };
  if (!threadId || !/^[0-9a-f-]{36}$/i.test(threadId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: thread } = await svc
    .from("threads")
    .select("id, listing_id, participant_a, participant_b")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread || (thread.participant_a !== user.id && thread.participant_b !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data: msgs } = await svc
    .from("messages")
    .select("sender_id, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(50);
  const latest = msgs?.[0];
  if (
    !latest ||
    latest.sender_id !== user.id ||
    Date.now() - new Date(latest.created_at).getTime() > 5 * 60 * 1000
  ) {
    return NextResponse.json({ sent: false, reason: "no recent message" });
  }
  const recipientId = thread.participant_a === user.id ? thread.participant_b : thread.participant_a;
  if (!recipientId) return NextResponse.json({ sent: false, reason: "recipient deleted" });
  const isOffer = (msgs?.length ?? 0) === 1;

  const prefs = await getPrefs(svc, recipientId);
  if (!prefs.message_alerts) return NextResponse.json({ sent: false, reason: "opted out" });
  if (!emailEnabled()) return NextResponse.json({ sent: false, reason: "email not configured" });

  const { data: claimed } = await svc.rpc("claim_thread_email", {
    p_thread: threadId,
    p_recipient: recipientId,
  });
  if (!claimed) return NextResponse.json({ sent: false, reason: "throttled" });

  const to = await getEmail(svc, recipientId);
  if (!to) return NextResponse.json({ sent: false, reason: "no email" });

  const [{ data: sender }, { data: listing }] = await Promise.all([
    svc.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    thread.listing_id
      ? svc.from("listings").select("title").eq("id", thread.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const name = (sender?.display_name as string) || "An AgsSwap member";
  const title = (listing?.title as string) || "your listing";
  const subject = isOffer ? `New offer on "${title}"` : `New message about "${title}"`;
  const unsub = unsubscribeUrl(prefs.unsubscribe_token, "messages");
  const { html, text } = layout({
    heading: isOffer ? "You've got a new offer!" : "You've got a new message",
    lines: [
      isOffer
        ? `${name} sent you an offer on "${title}".`
        : `${name} sent you a message about "${title}".`,
      "Open AgsSwap to read it and reply.",
    ],
    buttonText: "Open conversation",
    buttonUrl: `${appUrl()}/inbox/${threadId}`,
    unsubscribeUrl: unsub,
    unsubscribeLabel: "Turn off message emails",
  });
  const ok = await sendEmail({ to, subject, html, text, unsubscribeUrl: unsub });
  return NextResponse.json({ sent: ok });
}
