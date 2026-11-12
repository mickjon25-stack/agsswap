import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { sortedPhotos, statusChipClass } from "@/lib/listing-ui";
import { ListingPhotos } from "@/components/ListingPhotos";
import { withSignedPhotoUrls } from "@/lib/listing-photos";
import type { Listing } from "@/lib/types";
import { OfferForm } from "./OfferForm";
import { ReportForm } from "./ReportForm";
import { BumpButton } from "@/components/BumpButton";
import { DeleteListingButton } from "@/components/DeleteListingButton";
import { Avatar } from "@/components/Avatar";
import { isRecentlyBumped } from "@/lib/billing";
import { intentClass } from "@/components/ListingCard";
import { RatingBadge } from "@/components/RatingBadge";
import { fetchRatings } from "@/lib/ratings";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ListingDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  if (!hasSupabaseConfig()) {
    return (
      <div className="wrap">
        <div className="warn">Configure Supabase to view listing detail.</div>
        <Link href="/browse" className="ghost">
          ← Browse
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("listings")
    .select(
      "*, listing_photos(*), profiles:poster_id(id, display_name, avatar_url, city, company, is_ranch)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const [listing] = await withSignedPhotoUrls(supabase, [data as Listing]);
  const photos = sortedPhotos(listing.listing_photos);
  const poster = listing.profiles;
  const ratings = await fetchRatings(supabase, [listing.poster_id]);

  return (
    <div className="wrap">
      <Link href="/browse" className="back-link">
        ← Back to browse
      </Link>
      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div className="detail-photos">
          <ListingPhotos title={listing.title} photos={photos} />
        </div>
        <div className="panel listing-main">
            <div className="listing-chips">
              <span className={`pill ${intentClass(listing.intent)}`}>{listing.intent}</span>
              <span className={`status-chip ${statusChipClass(listing.status)}`}>
                {listing.status}
              </span>
              {isRecentlyBumped(listing.bumped_at) ? (
                <span className="pill boosted">Boosted</span>
              ) : null}
            </div>
            <h2 className="listing-title">{listing.title}</h2>
            <p className="listing-price">
              {listing.intent === "Fast & Free"
                ? "Free — claim before the window closes"
                : listing.price > 0
                  ? `$${Number(listing.price).toFixed(2)}`
                  : "Open to swap"}
            </p>
            <p className="meta">
              {listing.intent} · {listing.category} · {listing.condition}
            </p>
            <p>{listing.description}</p>
            {listing.looking_for ? (
              <p>
                <strong>Looking for:</strong> {listing.looking_for}
              </p>
            ) : null}
            <p className="meta listing-loc">
              {listing.city}, {listing.zip}
              {listing.pickup_ok ? " · Pickup OK" : ""}
              {listing.shipping_ok ? " · Shipping OK" : ""}
              {listing.scrap_bound ? " · Headed for scrap" : ""}
            </p>
          </div>

        <div className="stack detail-side">
          {user && user.id === listing.poster_id ? (
            <div className="panel">
              {listing.status === "Deleted" ? (
                <>
                  <h3 style={{ marginTop: 0 }}>Deleted</h3>
                  <p className="help" style={{ marginTop: 0 }}>
                    This listing is removed from Browse. It stays in My listings for your records.
                  </p>
                </>
              ) : (
                <>
                  <h3 style={{ marginTop: 0 }}>Manage listing</h3>
                  <p className="help" style={{ marginTop: 0 }}>
                    {isRecentlyBumped(listing.bumped_at)
                      ? "Currently boosted on Browse (within 7 days)."
                      : "Boost sorts this listing first on Browse for 7 days."}
                  </p>
                  <div className="actions" style={{ marginBottom: 12 }}>
                    <Link href={`/listings/${listing.id}/edit`} className="primary">
                      Edit post
                    </Link>
                    <BumpButton
                      listingId={listing.id}
                      bumpedAt={listing.bumped_at}
                    />
                  </div>
                  <p className="help">
                    Delete removes it from Browse right away. Open offers are closed.
                  </p>
                  <DeleteListingButton listingId={listing.id} title={listing.title} />
                </>
              )}
            </div>
          ) : null}

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Poster</h3>
            <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
              <Avatar url={poster?.avatar_url} name={poster?.display_name || "Member"} />
              <div>
                <strong>
                  <Link href={`/members/${listing.poster_id}`}>{poster?.display_name || "Member"}</Link>
                </strong>
                {poster?.is_ranch ? (
                  <span className="pill ranch" style={{ marginLeft: 8 }}>
                    Ranch / Farm
                  </span>
                ) : null}
                <div className="meta">
                  {poster?.is_ranch && poster.company
                    ? poster.company
                    : poster?.city || "Local"}
                </div>
                <RatingBadge rating={ratings[listing.poster_id]} />
              </div>
            </div>
          </div>

          {user && user.id !== listing.poster_id && listing.status === "Approved" ? (
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Make an offer / message</h3>
              <p className="help" style={{ marginTop: 0 }}>
                Sends an offer, emails the poster (if alerts are on), and opens a
                thread in your <Link href="/inbox">Inbox</Link>.
              </p>
              <OfferForm listingId={listing.id} allowSwap={listing.intent !== "Sell"} />
            </div>
          ) : null}

          {user ? (
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Report</h3>
              <ReportForm listingId={listing.id} reportedUserId={listing.poster_id} />
            </div>
          ) : listing.status === "Approved" ? (
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Make an offer</h3>
              <p className="help" style={{ marginTop: 0 }}>
                Sign in to make an offer or message the poster. After you sign
                in, you&apos;ll come back to this listing.
              </p>
              <div className="actions">
                <Link
                  href={`/auth?next=${encodeURIComponent(`/listings/${listing.id}`)}&reason=offer`}
                  className="primary"
                >
                  Sign in to make an offer
                </Link>
                <Link
                  href={`/auth?mode=signup&next=${encodeURIComponent(`/listings/${listing.id}`)}&reason=offer`}
                  className="ghost"
                >
                  Create account
                </Link>
              </div>
              <p className="help" style={{ marginBottom: 0, marginTop: 12 }}>
                Need to report this listing? Sign in first — reporting is available
                from this page after you&apos;re signed in.
              </p>
            </div>
          ) : (
            <div className="panel">
              <p className="help" style={{ marginBottom: 0 }}>
                <Link
                  href={`/auth?next=${encodeURIComponent(`/listings/${listing.id}`)}`}
                >
                  Sign in
                </Link>{" "}
                to report this listing.
              </p>
            </div>
          )}

          <div className="warn">
            AgsSwap never holds payment. Arrange pickup / Venmo /
            Zelle / cash off-platform. Stay safe — public places for first meetups.
          </div>
        </div>
      </div>
    </div>
  );
}
