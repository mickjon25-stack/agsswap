import Link from "next/link";
import type { Listing } from "@/lib/types";
import { primaryPhotoUrl } from "@/lib/listing-ui";
import { isRecentlyBumped } from "@/lib/billing";
import type { Rating } from "@/lib/ratings";
import { RatingBadge } from "./RatingBadge";

export function intentClass(intent: string) {
  if (intent === "Fast & Free") return "free";
  if (intent === "Sell") return "sell";
  if (intent === "Sell or Swap") return "sellswap";
  return "swap";
}

export function ListingCard({
  listing,
  rating,
  milesAway,
  priority = false,
}: {
  listing: Listing;
  rating?: Rating | null;
  milesAway?: number;
  /** Eager-load the photo (first cards in the Browse grid). */
  priority?: boolean;
}) {
  const photo = primaryPhotoUrl(listing.listing_photos);
  const boosted = isRecentlyBumped(listing.bumped_at);
  const priceLabel =
    listing.intent === "Fast & Free"
      ? "Free"
      : listing.price > 0
        ? `$${Number(listing.price).toFixed(0)}`
        : "Swap";

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`card${listing.status === "Claimed" ? " is-claimed" : ""}${boosted ? " is-boosted" : ""}`}
    >
      <div className={`thumb${photo ? "" : " thumb-empty"}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="thumb-img"
            src={photo}
            alt=""
            width={640}
            height={640}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
          />
        ) : null}
        <div className="badges">
          <span className={`badge ${intentClass(listing.intent)}`}>
            {listing.intent}
          </span>
          {boosted ? <span className="badge boosted">Boosted</span> : null}
        </div>
        {listing.status === "Claimed" ? (
          <span className="badge claimed">Claimed</span>
        ) : null}
        {listing.status === "Pending Review" ? (
          <span className="badge status-pending">Pending</span>
        ) : null}
      </div>
      <div className="card-body">
        <div className="card-top">
          <h3>{listing.title}</h3>
          <span className={`price${priceLabel === "Free" ? " price-free" : priceLabel === "Swap" ? " price-swap" : ""}`}>
            {priceLabel}
          </span>
        </div>
        <div className="meta">
          {listing.category} · {listing.condition}
        </div>
        <div className="card-loc meta">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
            />
          </svg>
          {listing.city}, {listing.zip}
          {typeof milesAway === "number" ? (
            <span className="miles-away"> · ~{Math.max(1, milesAway)} mi</span>
          ) : null}
        </div>
        <div className="meta">
          <RatingBadge rating={rating} />
        </div>
      </div>
    </Link>
  );
}
