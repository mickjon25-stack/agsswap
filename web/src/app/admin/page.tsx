import Link from "next/link";
import { getMyProfile } from "@/lib/supabase/my-profile";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { withSignedPhotoUrls } from "@/lib/listing-photos";
import { primaryPhotoUrl } from "@/lib/listing-ui";
import type { Listing, Report } from "@/lib/types";
import { AdminActions } from "./AdminActions";
import { ReportActions } from "./ReportActions";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

type PendingListing = Listing & {
  profiles?: { display_name: string | null } | null;
};

export default async function AdminPage() {
  if (!hasSupabaseConfig()) {
    return (
      <div className="wrap">
        <div className="warn">Configure Supabase for the admin queue.</div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await getMyProfile(supabase);

  if (!profile?.is_admin) {
    return (
      <div className="wrap">
        <div className="err">
          Admin only. Set <code>profiles.is_admin = true</code> for your user in
          Supabase.
        </div>
      </div>
    );
  }

  const { data: pending } = await supabase
    .from("listings")
    .select(
      "*, listing_photos(*), profiles:poster_id(display_name)"
    )
    .eq("status", "Pending Review")
    .order("created_at", { ascending: true });

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("status", "Pending")
    .order("created_at", { ascending: true });

  const [{ data: reviewRows }, { data: reviewReportRows }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, stars, comment, hidden, created_at, reviewer_id, reviewee_id")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("review_reports")
      .select("id, review_id, reason")
      .eq("status", "Pending"),
  ]);
  type AdminReview = { id: string; stars: number; comment: string; hidden: boolean; created_at: string; reviewer_id: string | null; reviewee_id: string };
  const adminReviews = (reviewRows as AdminReview[]) || [];
  const reviewReports = (reviewReportRows as { id: string; review_id: string; reason: string }[]) || [];
  const reportsByReview = new Map<string, string[]>();
  for (const rr of reviewReports) {
    reportsByReview.set(rr.review_id, [...(reportsByReview.get(rr.review_id) || []), rr.reason || "(no reason)"]);
  }
  const reviewPeopleIds = Array.from(new Set(adminReviews.flatMap((r) => [r.reviewer_id, r.reviewee_id]).filter((x): x is string => !!x)));
  const { data: reviewPeople } = reviewPeopleIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", reviewPeopleIds)
    : { data: [] };
  const personName = new Map(
    ((reviewPeople as { id: string; display_name: string | null }[]) || []).map((p) => [p.id, p.display_name || "Member"])
  );
  const sortedReviews = [...adminReviews].sort(
    (a, b) => Number(reportsByReview.has(b.id)) - Number(reportsByReview.has(a.id))
  );

  const listings = await withSignedPhotoUrls(supabase, (pending as PendingListing[]) || []);
  const pendingReports = (reports as Report[]) || [];

  return (
    <div className="wrap stack">
      <h2 className="page-title" style={{ margin: 0 }}>Admin queue</h2>
      <p className="help">
        Approve / reject listings. Fast & Free timer starts on approve.
      </p>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>
          Pending listings ({listings.length})
        </h3>
        {listings.length === 0 ? (
          <p className="muted">No pending listings.</p>
        ) : (
          <table className="table table-cards">
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Intent / ZIP</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => {
                const thumb = primaryPhotoUrl(l.listing_photos);
                const posterName = l.profiles?.display_name || "Member";
                return (
                  <tr key={l.id}>
                    <td style={{ width: 64 }}>
                      <div
                        className="thumb"
                        style={{
                          height: 52,
                          width: 52,
                          borderRadius: 10,
                          backgroundImage: thumb ? `url(${thumb})` : undefined,
                        }}
                      />
                    </td>
                    <td>
                      <Link href={`/listings/${l.id}`}>
                        <strong>{l.title}</strong>
                      </Link>
                      <div className="help">
                        {l.category} · {l.condition} · by {posterName}
                      </div>
                      <div className="help">{l.description.slice(0, 140)}</div>
                    </td>
                    <td>
                      {l.intent}
                      <div className="help">
                        {l.city}, {l.zip}
                      </div>
                      <div className="help">
                        {(l.listing_photos?.length ?? 0)} photo
                        {(l.listing_photos?.length ?? 0) === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td>
                      <AdminActions
                        listingId={l.id}
                        intent={l.intent}
                        fastWindowHours={l.fast_window_hours}
                        photoCount={l.listing_photos?.length ?? 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>
          Pending reports ({pendingReports.length})
        </h3>
        {pendingReports.length === 0 ? (
          <p className="muted">No pending reports.</p>
        ) : (
          <table className="table table-cards">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingReports.map((r) => (
                <tr key={r.id}>
                  <td>{r.reason}</td>
                  <td>
                    <div className="help">{r.details || "—"}</div>
                    <div className="help">
                      listing:{" "}
                      {r.listing_id ? (
                        <Link href={`/listings/${r.listing_id}`}>
                          {r.listing_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}{" "}
                      · user: {r.reported_user_id || "—"}
                    </div>
                  </td>
                  <td>
                    <ReportActions reportId={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>
          Reviews ({reviewReports.length} reported)
        </h3>
        {sortedReviews.length === 0 ? (
          <p className="muted">No reviews yet.</p>
        ) : (
          <table className="table table-cards">
            <thead>
              <tr>
                <th>Review</th>
                <th>Who</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedReviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{"⭐".repeat(r.stars)}</strong>
                    {r.hidden ? <span className="pill" style={{ marginLeft: 8 }}>Hidden</span> : null}
                    <div className="help">{r.comment || "—"}</div>
                    {reportsByReview.has(r.id) ? (
                      <div className="err" style={{ marginTop: 4 }}>
                        Reported: {reportsByReview.get(r.id)!.join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="help">
                    {r.reviewer_id ? personName.get(r.reviewer_id) : "Deleted member"} → {" "}
                    <Link href={`/members/${r.reviewee_id}`}>{personName.get(r.reviewee_id)}</Link>
                  </td>
                  <td>
                    <ReviewActions
                      reviewId={r.id}
                      hidden={r.hidden}
                      reportIds={reviewReports.filter((x) => x.review_id === r.id).map((x) => x.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
