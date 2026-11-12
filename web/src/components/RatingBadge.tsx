import type { Rating } from "@/lib/ratings";
import { ratingLabel } from "@/lib/ratings";

export function RatingBadge({ rating }: { rating?: Rating | null }) {
  const isNew = !rating || rating.count === 0;
  return (
    <span className={`rating-badge${isNew ? " is-new" : ""}`}>{ratingLabel(rating)}</span>
  );
}
