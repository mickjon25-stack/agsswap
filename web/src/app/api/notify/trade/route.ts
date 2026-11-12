import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { appUrl, emailEnabled, sendEmail } from "@/lib/email/send";
import { layout } from "@/lib/email/templates";
import { getEmail, getPrefs, unsubscribeUrl } from "@/lib/email/prefs";

export const runtime = "nodejs";

type Event = "requested" | "confirmed";

/**
 * Email the other trade party after someone marks complete or confirms.
 * Respects message_alerts (same toggle as offers/messages). No message body.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    tradeId?: string;
    event?: Event;
  };
  const tradeId = body.tradeId;
  const event = body.event;
  if (!tradeId || !/^[0-9a-f-]{36}$/i.test(tradeId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (event !== "requested" && event !== "confirmed") {
    return NextResponse.json({ error: "bad event" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: trade } = await svc
    .from("trades")
    .select("id, status, requested_by, party_a, party_b, thread_id, listing_id")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade || (trade.party_a !== user.id && trade.party_b !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (event === "requested") {
    if (trade.status !== "Pending" || trade.requested_by !== user.id) {
      return NextResponse.json({ sent: false, reason: "not a pending request by you" });
    }
  } else {
    // Confirmer is the other party after status becomes Confirmed.
    if (trade.status !== "Confirmed" || trade.requested_by === user.id) {
      return NextResponse.json({ sent: false, reason: "not a confirmation by you" });
    }
  }

  const recipientId = trade.party_a === user.id ? trade.party_b : trade.party_a;
  if (!recipientId) return NextResponse.json({ sent: false, reason: "recipient deleted" });

  const prefs = await getPrefs(svc, recipientId);
  if (!prefs.message_alerts) return NextResponse.json({ sent: false, reason: "opted out" });
  if (!emailEnabled()) return NextResponse.json({ sent: false, reason: "email not configured" });

  const to = await getEmail(svc, recipientId);
  if (!to) return NextResponse.json({ sent: false, reason: "no email" });

  const [{ data: actor }, { data: listing }] = await Promise.all([
    svc.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    trade.listing_id
      ? svc.from("listings").select("title").eq("id", trade.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const name = (actor?.display_name as string) || "An AgsSwap member";
  const title = (listing?.title as string) || "your listing";
  const threadUrl = `${appUrl()}/inbox/${trade.thread_id}`;
  const unsub = unsubscribeUrl(prefs.unsubscribe_token, "messages");

  const copy =
    event === "requested"
      ? {
          subject: `Confirm your trade on "${title}"`,
          heading: "Please confirm this trade",
          lines: [
            `${name} marked the trade for "${title}" as complete.`,
            "Open the conversation and tap “Yes, confirm trade” if that’s right. After you both confirm, you can leave a review.",
          ],
          buttonText: "Open conversation",
        }
      : {
          subject: `Trade confirmed — "${title}"`,
          heading: "Trade confirmed — you can leave a review",
          lines: [
            `${name} confirmed the trade for "${title}".`,
            "Reviews are unlocked. Rate how the meetup went (you rate the person, not the listing).",
          ],
          buttonText: "Leave a review",
        };

  const { html, text } = layout({
    heading: copy.heading,
    lines: copy.lines,
    buttonText: copy.buttonText,
    buttonUrl: threadUrl,
    unsubscribeUrl: unsub,
    unsubscribeLabel: "Turn off message emails",
  });
  const ok = await sendEmail({ to, subject: copy.subject, html, text, unsubscribeUrl: unsub });
  return NextResponse.json({ sent: ok });
}
