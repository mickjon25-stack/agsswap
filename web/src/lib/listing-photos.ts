import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingPhoto } from "./types";

export const LISTING_PHOTO_BUCKET = "listing-photos";

/** Signed photo links stay valid this long (seconds). Pages are rendered per request. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

type WithPhotos = { listing_photos?: ListingPhoto[] | null };

/**
 * The listing-photos bucket is private. Storage policies only let a caller sign
 * photos of listings they can see (Approved/Claimed for everyone; the owner and
 * admins also see Pending/Rejected/Expired). This replaces each photo's
 * `public_url` with a short-lived signed URL, or null if the caller may not see it.
 */
export async function withSignedPhotoUrls<T extends WithPhotos>(
  supabase: SupabaseClient,
  listings: T[]
): Promise<T[]> {
  const paths = Array.from(
    new Set(
      listings.flatMap((l) => (l.listing_photos || []).map((p) => p.storage_path).filter(Boolean))
    )
  );
  const signed = new Map<string, string>();
  if (paths.length) {
    try {
      const { data } = await supabase.storage
        .from(LISTING_PHOTO_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      for (const item of data || []) {
        if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
      }
    } catch {
      // Fall through: photos render as placeholders rather than breaking the page.
    }
  }
  return listings.map((l) => ({
    ...l,
    listing_photos: (l.listing_photos || []).map((p) => ({
      ...p,
      public_url: signed.get(p.storage_path) ?? null,
    })),
  }));
}
