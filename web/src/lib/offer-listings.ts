import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingPhoto } from "./types";
import { withSignedPhotoUrls } from "./listing-photos";
import { primaryPhotoUrl } from "./listing-ui";
import type { LinkedListing } from "@/components/LinkedListings";

type Row = { id: string; title: string; listing_photos: ListingPhoto[] | null };

/** Loads listings by id with a signed primary photo, preserving order. */
export async function loadLinkedListings(
  supabase: SupabaseClient,
  ids: string[]
): Promise<LinkedListing[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const { data } = await supabase
    .from("listings")
    .select("id, title, listing_photos(*)")
    .in("id", unique);
  const signed = await withSignedPhotoUrls(supabase, (data as Row[] | null) || []);
  const byId = new Map(signed.map((l) => [l.id, l]));
  return unique
    .map((id) => byId.get(id))
    .filter((l): l is Row => !!l)
    .map((l) => ({ id: l.id, title: l.title, photo: primaryPhotoUrl(l.listing_photos) ?? null }));
}

/** Offered-listing ids per offer id (only offers the caller can see). */
export async function offeredListingIds(
  supabase: SupabaseClient,
  offerIds: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!offerIds.length) return out;
  const { data } = await supabase
    .from("offer_listings")
    .select("offer_id, listing_id, created_at")
    .in("offer_id", offerIds)
    .order("created_at", { ascending: true });
  for (const r of (data as { offer_id: string; listing_id: string }[] | null) || []) {
    out.set(r.offer_id, [...(out.get(r.offer_id) || []), r.listing_id]);
  }
  return out;
}
