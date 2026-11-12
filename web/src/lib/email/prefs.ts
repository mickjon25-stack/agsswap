import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl } from "./send";

export type Prefs = { message_alerts: boolean; looking_for_alerts: boolean; unsubscribe_token: string };

/** Service-role: get (or create) a member's prefs row. */
export async function getPrefs(svc: SupabaseClient, userId: string): Promise<Prefs> {
  const { data } = await svc
    .from("notification_prefs")
    .select("message_alerts, looking_for_alerts, unsubscribe_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as Prefs;
  const { data: created, error } = await svc
    .from("notification_prefs")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("message_alerts, looking_for_alerts, unsubscribe_token")
    .single();
  if (error) throw error;
  return created as Prefs;
}

export async function getEmail(svc: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await svc.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (data?.email) return data.email as string;
  const { data: u } = await svc.auth.admin.getUserById(userId);
  return u?.user?.email ?? null;
}

export function unsubscribeUrl(token: string, type: "messages" | "looking_for") {
  return `${appUrl()}/api/unsubscribe?t=${encodeURIComponent(token)}&type=${type}`;
}
