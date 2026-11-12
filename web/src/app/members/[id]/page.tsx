import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { RatingBadge } from "@/components/RatingBadge";
import { createClient } from "@/lib/supabase/server";
import { fetchRatings } from "@/lib/ratings";
import { formatAppDate } from "@/lib/datetime";
import Link from "next/link";
import { ReportReview } from "./ReportReview";
import { LeaveReviewForm } from "@/components/LeaveReviewForm";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function MemberPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, city, company, is_ranch")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const ratings = await fetchRatings(supabase, [id]);

  type OpenReview = { tradeId: string; threadId: string | null; listingTitle: string };
  type PendingTrade = { threadId: string; listingTitle: string; waitingOnThem: boolean };
  const openReviews: OpenReview[] = [];
  const pendingTrades: PendingTrade[] = [];
  if (user && user.id !== id) {
    const { data: tradeRows } = await supabase
      .from("trades")
      .select("id, status, requested_by, thread_id, listing_id, party_a, party_b, listings:listing_id(title)")
      .or(
        `and(party_a.eq.${user.id},party_b.eq.${id}),and(party_a.eq.${id},party_b.eq.${user.id})`
      )
      .order("created_at", { ascending: false });
    const trades = (tradeRows as {
      id: string; status: string; requested_by: string; thread_id: string | null; listing_id: string | null;
      party_a: string; party_b: string;
      listings: { title: string } | { title: string }[] | null;
    }[] | null) || [];
    const confirmedIds = trades.filter((t) => t.status === "Confirmed").map((t) => t.id);
    const already = new Set<string>();
    if (confirmedIds.length) {
      const { data: mine } = await supabase
        .from("reviews")
        .select("trade_id")
        .eq("reviewer_id", user.id)
        .in("trade_id", confirmedIds);
      for (const r of (mine as { trade_id: string }[] | null) || []) already.add(r.trade_id);
    }
    for (const t of trades) {
      const title = Array.isArray(t.listings) ? t.listings[0]?.title : t.listings?.title;
      const listingTitle = title || "a listing";
      if (t.status === "Confirmed" && !already.has(t.id)) {
        openReviews.push({ tradeId: t.id, threadId: t.thread_id, listingTitle });
      } else if (t.status === "Pending" && t.thread_id) {
        pendingTrades.push({
          threadId: t.thread_id,
          listingTitle,
          waitingOnThem: t.requested_by === user.id,
        });
      }
    }
  }

  const { data: reviews } = await supabase
    .from("public_reviews")
    .select("id, stars, comment, created_at, reviewer_id")
    .eq("reviewee_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows =
    (reviews as { id: string; stars: number; comment: string; created_at: string; reviewer_id: string | null }[]) || [];
  const { data: reviewers } = rows.length
    ? await supabase.from("profiles").select("id, display_name").in("id", rows.map((r) => r.reviewer_id).filter((x): x is string => !!x))
    : { data: [] };
  const names = new Map(
    ((reviewers as { id: string; display_name: string | null }[]) || []).map((p) => [p.id, p.display_name])
  );
  const list = rows.map((r) => ({ ...r, name: r.reviewer_id ? names.get(r.reviewer_id) || "Member" : "Deleted member" }));

  return (
    <div className="wrap stack">
      <div className="panel">
        <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
          <Avatar url={profile.avatar_url} name={profile.display_name || "Member"} />
          <div>
            <h2 style={{ margin: 0 }}>{profile.display_name || "Member"}</h2>
            <div className="meta">
              {profile.is_ranch && profile.company ? profile.company : profile.city || ""}
            </div>
            <RatingBadge rating={ratings[id]} />
          </div>
        </div>
      </div>
      {openReviews.length || pendingTrades.length ? (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Your trades with {profile.display_name || "this member"}</h3>
          {pendingTrades.map((t) => (
            <div key={t.threadId} className="help" style={{ marginBottom: 12 }}>
              {t.waitingOnThem ? (
                <>
                  Waiting for them to confirm the trade for <strong>{t.listingTitle}</strong>.{" "}
                </>
              ) : (
                <>
                  They marked the trade for <strong>{t.listingTitle}</strong> complete — confirm it to unlock reviews.{" "}
                </>
              )}
              <Link href={`/inbox/${t.threadId}`}>Open conversation →</Link>
            </div>
          ))}
          {openReviews.map((t) => (
            <div key={t.tradeId} style={{ marginBottom: 16 }}>
              <p className="help" style={{ marginTop: 0 }}>
                Confirmed trade: <strong>{t.listingTitle}</strong>
                {t.threadId ? (
                  <>
                    {" "}
                    · <Link href={`/inbox/${t.threadId}`}>View chat</Link>
                  </>
                ) : null}
              </p>
              <LeaveReviewForm
                tradeId={t.tradeId}
                reviewerId={user!.id}
                revieweeId={id}
                revieweeName={profile.display_name || "Member"}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Reviews</h3>
        {list.length === 0 ? (
          <p className="muted">No reviews yet.</p>
        ) : (
          <ul className="review-list">
            {list.map((r) => {
              return (
                <li key={r.id} className="review-item">
                  <div className="row">
                    <strong>{"⭐".repeat(r.stars)}</strong>
                    {user && user.id !== r.reviewer_id ? (
                      <ReportReview reviewId={r.id} userId={user.id} />
                    ) : null}
                  </div>
                  {r.comment ? <p style={{ margin: "4px 0" }}>{r.comment}</p> : null}
                  <div className="help">
                    {r.name} ·{" "}
                    {formatAppDate(r.created_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
