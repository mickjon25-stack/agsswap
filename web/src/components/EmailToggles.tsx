"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveClientUser } from "@/lib/supabase/client-auth";

type Prefs = { message_alerts: boolean; looking_for_alerts: boolean };

/** On/off switches for each email alert type (own row only, via RLS). */
export function EmailToggles() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await resolveClientUser();
      if (!user) return;
      setUserId(user.id);
      const supabase = createClient();
      const { data } = await supabase
        .from("notification_prefs")
        .select("message_alerts, looking_for_alerts")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
      else {
        await supabase.from("notification_prefs").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
        setPrefs({ message_alerts: true, looking_for_alerts: true });
      }
    })();
  }, []);

  async function toggle(key: keyof Prefs) {
    if (!prefs || !userId) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const { error: err } = await createClient()
      .from("notification_prefs")
      .update({ [key]: next[key], updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (err) {
      setError(err.message);
      setPrefs(prefs);
    }
  }

  if (!prefs) return null;
  return (
    <div className="stack">
      {error ? <div className="err">{error}</div> : null}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={prefs.message_alerts} onChange={() => toggle("message_alerts")} />
        Email me about new offers, messages, and trade updates
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={prefs.looking_for_alerts} onChange={() => toggle("looking_for_alerts")} />
        Email me when something I&apos;m looking for is posted
      </label>
    </div>
  );
}
