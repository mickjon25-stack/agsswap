"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resolveClientUser } from "@/lib/supabase/client-auth";
import { getMyProfile } from "@/lib/supabase/my-profile";
import { CATEGORIES, INTENTS } from "@/lib/constants";
import { EmailToggles } from "@/components/EmailToggles";

type SavedAlert = {
  id: string;
  keywords: string;
  category: string | null;
  intent: string | null;
  max_miles: number | null;
  zip: string | null;
};

const DISTANCES = [25, 50, 100, 250];

export default function AlertsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SavedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({ keywords: "", category: "", intent: "", miles: "", zip: "" });

  async function load() {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("saved_alerts")
      .select("id, keywords, category, intent, max_miles, zip")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setAlerts((data as SavedAlert[]) || []);
  }

  useEffect(() => {
    (async () => {
      const user = await resolveClientUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUserId(user.id);
      const { data: p } = await getMyProfile(createClient());
      if (p?.zip) setForm((f) => ({ ...f, zip: p.zip.slice(0, 5) }));
      await load();
      setLoading(false);
    })();
  }, [router]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const keywords = form.keywords.trim();
    if (keywords.length < 2) return setError("Type what you're looking for, like \"cattle panels\".");
    const miles = form.miles ? Number(form.miles) : null;
    if (miles && !/^\d{5}$/.test(form.zip.trim())) return setError("Add a 5-digit ZIP to use a distance.");
    const { error: err } = await createClient().from("saved_alerts").insert({
      user_id: userId,
      keywords: keywords.slice(0, 80),
      category: form.category || null,
      intent: form.intent || null,
      max_miles: miles,
      zip: form.zip.trim() ? form.zip.trim() : null,
    });
    if (err) return setError(err.message);
    setForm((f) => ({ ...f, keywords: "" }));
    setOk("Alert saved. We'll email you when a matching listing is approved.");
    await load();
  }

  async function remove(id: string) {
    const { error: err } = await createClient().from("saved_alerts").delete().eq("id", id);
    if (err) setError(err.message);
    await load();
  }

  if (loading) return <div className="wrap"><p className="muted">Loading alerts…</p></div>;

  return (
    <div className="wrap">
      <div className="panel form-panel stack" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h2 style={{ margin: 0 }}>Email alerts</h2>
        <EmailToggles />

        <h3 style={{ marginBottom: 0 }}>&quot;Looking for&quot; alerts</h3>
        <p className="help">
          Tell us what you need. When a new listing that matches is approved, we&apos;ll email you.
        </p>
        {error ? <div className="err">{error}</div> : null}
        {ok ? <div className="ok">{ok}</div> : null}
        <form onSubmit={onAdd} className="stack">
          <div className="field">
            <label htmlFor="al-kw">Looking for</label>
            <input id="al-kw" value={form.keywords} maxLength={80} placeholder="cattle panels"
              onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="al-cat">Category (optional)</label>
            <select id="al-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Any category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="al-int">Type (optional)</label>
            <select id="al-int" value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}>
              <option value="">Any type</option>
              {INTENTS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="al-mi">Distance (optional)</label>
            <select id="al-mi" value={form.miles} onChange={(e) => setForm({ ...form, miles: e.target.value })}>
              <option value="">Any distance</option>
              {DISTANCES.map((d) => <option key={d} value={d}>Within {d} miles</option>)}
            </select>
          </div>
          {form.miles ? (
            <div className="field">
              <label htmlFor="al-zip">From ZIP</label>
              <input id="al-zip" inputMode="numeric" maxLength={5} value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\D/g, "") })} />
            </div>
          ) : null}
          <button className="primary" type="submit">Save alert</button>
        </form>

        {alerts.length ? (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {alerts.map((a) => (
              <li key={a.id} className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <span>
                  <strong>{a.keywords}</strong>
                  <span className="muted">
                    {" · "}{a.category || "Any category"}{" · "}{a.intent || "Any type"}
                    {" · "}{a.max_miles ? `within ${a.max_miles} mi of ${a.zip}` : "any distance"}
                  </span>
                </span>
                <button className="ghost" type="button" onClick={() => remove(a.id)}>Delete</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No saved alerts yet.</p>
        )}
        <p><Link href="/account">Back to account</Link></p>
      </div>
    </div>
  );
}
