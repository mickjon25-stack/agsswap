import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { appUrl, emailEnabled, sendEmail } from "@/lib/email/send";
import { layout } from "@/lib/email/templates";
import { getEmail, getPrefs, unsubscribeUrl } from "@/lib/email/prefs";

export const runtime = "nodejs";

/** Called by the admin page after approving a listing. Emails members whose saved alerts match (never the poster). */
export async function POST(req: Request) {
  const { listingId } = (await req.json().catch(() => ({}))) as { listingId?: string };
  if (!listingId || !/^[0-9a-f-]{36}$/i.test(listingId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: listing } = await svc
    .from("listings")
    .select("id, title, city, intent, status")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status !== "Approved") {
    return NextResponse.json({ sent: 0, reason: "not approved" });
  }
  const { data: matches, error } = await svc.rpc("match_listing_alerts", { p_listing: listingId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!emailEnabled()) {
    return NextResponse.json({ sent: 0, matched: matches?.length ?? 0, reason: "email not configured" });
  }

  let sent = 0;
  for (const m of (matches ?? []) as { user_id: string; keywords: string }[]) {
    // De-dupe: one email per member per listing, even if approved twice.
    const { data: logged } = await svc
      .from("listing_alert_log")
      .upsert({ listing_id: listingId, user_id: m.user_id }, { onConflict: "listing_id,user_id", ignoreDuplicates: true })
      .select("user_id");
    if (!logged?.length) continue;
    const prefs = await getPrefs(svc, m.user_id);
    if (!prefs.looking_for_alerts) continue;
    const to = await getEmail(svc, m.user_id);
    if (!to) continue;
    const unsub = unsubscribeUrl(prefs.unsubscribe_token, "looking_for");
    const { html, text } = layout({
      heading: "Something you're looking for just got posted",
      lines: [
        `A new listing matches your alert "${m.keywords}":`,
        `${listing.title}${listing.city ? ` (${listing.city})` : ""} · ${listing.intent}`,
        "Good finds go fast, so take a look soon.",
      ],
      buttonText: "See the listing",
      buttonUrl: `${appUrl()}/listings/${listingId}`,
      unsubscribeUrl: unsub,
      unsubscribeLabel: "Turn off 'Looking for' emails",
    });
    if (await sendEmail({ to, subject: `New match: ${listing.title}`, html, text, unsubscribeUrl: unsub })) sent++;
  }
  return NextResponse.json({ sent, matched: matches?.length ?? 0 });
}
