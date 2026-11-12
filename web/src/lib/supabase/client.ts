import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseConfig } from "./env";

export function createClient() {
  if (!hasSupabaseConfig()) {
    // Still construct a client so SSR/build does not crash; callers should
    // gate on hasSupabaseConfig() / isConfigured() and show a clear error.
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
    return createBrowserClient(url, key);
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
