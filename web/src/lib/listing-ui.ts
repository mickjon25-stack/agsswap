import type { ListingPhoto } from "./types";

/** CSS-safe slug for listing status chips (e.g. "Pending Review" → "pending-review"). */
export function statusChipClass(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sortedPhotos(photos: ListingPhoto[] | undefined | null): ListingPhoto[] {
  return (photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
}

export function primaryPhotoUrl(
  photos: ListingPhoto[] | undefined | null
): string | undefined {
  return sortedPhotos(photos)[0]?.public_url || undefined;
}
