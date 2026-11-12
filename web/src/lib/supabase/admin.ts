import { createClient } from "@supabase/supabase-js";

/**
 * Guard against a common misconfiguration: pasting the anon key into
 * SUPABASE_SERVICE_ROLE_KEY. With the anon key every webhook update silently
 * matches 0 rows (RLS + billing triggers), so plans never change.
 */
function assertServiceRoleKey(key: string) {
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is a publishable key. Use the service_role (or sb_secret_) key."
    );
  }
  const parts = key.split(".");
  if (parts.length !== 3) return; // sb_secret_… style keys
  try {
    const json = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { role?: string };
    if (json.role && json.role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY has role "${json.role}", expected "service_role". Copy the service_role key from Supabase → Project Settings → API.`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("SUPABASE_SERVICE_ROLE_KEY")) throw e;
  }
}

/** Service-role client for webhooks / trusted server updates. Never expose to the browser. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) required for billing webhooks."
    );
  }
  assertServiceRoleKey(key);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
