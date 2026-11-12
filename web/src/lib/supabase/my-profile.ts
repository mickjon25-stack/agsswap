import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

/**
 * The signed-in user's full profile row (including private fields like email,
 * ZIP and billing status). Private columns aren't selectable directly through
 * the public API, so this goes through the get_my_profile() database function.
 */
export async function getMyProfile(
  supabase: SupabaseClient
): Promise<{ data: Profile | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();
  return { data: (data as Profile | null) ?? null, error: error ?? null };
}
