/** True when public Supabase env looks like a real project (not placeholders). */
export function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) return false;
  if (url.includes("your-project") || url.includes("example.supabase")) return false;
  if (url.includes("placeholder.supabase")) return false;
  if (key.includes("your-anon") || key.includes("placeholder")) return false;
  // Real anon JWTs are long; reject obvious stubs.
  if (key.length < 20) return false;
  return url.startsWith("https://") && url.includes(".supabase.co");
}

/** Alias used by ConfigBanner / docs. */
export function isConfigured(): boolean {
  return hasSupabaseConfig();
}

export const MISSING_SUPABASE_ENV_MESSAGE =
  "Supabase is not configured. Copy web/.env.example to web/.env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your project API settings.";
