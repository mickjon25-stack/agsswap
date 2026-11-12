import type { SupabaseClient } from "@supabase/supabase-js";

export type Rating = { avg: number; count: number };

export async function fetchRatings(
  supabase: SupabaseClient,
  memberIds: string[]
): Promise<Record<string, Rating>> {
  const ids = Array.from(new Set(memberIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from("member_ratings")
    .select("member_id, avg_stars, review_count")
    .in("member_id", ids);
  const out: Record<string, Rating> = {};
  for (const r of (data as { member_id: string; avg_stars: number; review_count: number }[]) || []) {
    out[r.member_id] = { avg: Number(r.avg_stars), count: r.review_count };
  }
  return out;
}

export function ratingLabel(r?: Rating | null) {
  if (!r || r.count === 0) return "New member";
  return `⭐ ${r.avg.toFixed(1)} (${r.count} ${r.count === 1 ? "swap" : "swaps"})`;
}
