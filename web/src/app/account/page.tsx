"use client";

import { getMyProfile } from "@/lib/supabase/my-profile";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resolveClientUser } from "@/lib/supabase/client-auth";
import {
  hasSupabaseConfig,
  MISSING_SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";
import { usZipError } from "@/lib/us-zip";
import type { Profile } from "@/lib/types";
import { AvatarEditor } from "@/components/AvatarEditor";
import { EmailToggles } from "@/components/EmailToggles";
import { DeleteAccount } from "@/components/DeleteAccount";

export default function AccountPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [form, setForm] = useState({
    display_name: "",
    city: "",
    zip: "",
    bio: "",
    company: "",
    role: "Hobby farm",
    is_ranch: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!hasSupabaseConfig()) {
          setError(MISSING_SUPABASE_ENV_MESSAGE);
          return;
        }
        const user = await resolveClientUser();
        if (!user) {
          router.push("/auth");
          return;
        }
        if (cancelled) return;
        setUserId(user.id);
        setUserEmail(user.email ?? null);

        const supabase = createClient();
        const { data: existing, error: err } = await getMyProfile(supabase);
        if (err) throw err;

        let data = existing;
        if (!data) {
          const displayName =
            (user.user_metadata?.display_name as string | undefined) ||
            (user.email ? user.email.split("@")[0] : "user");
          // Insert-if-missing (ON CONFLICT DO NOTHING); private columns
          // aren't readable via the API, so re-read through getMyProfile().
          const { error: upErr } = await supabase.from("profiles").upsert(
            {
              id: user.id,
              email: user.email ?? null,
              display_name: displayName,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
          if (upErr) throw upErr;
          const { data: fresh, error: freshErr } = await getMyProfile(supabase);
          if (freshErr) throw freshErr;
          data = fresh;
        }

        if (!cancelled && data) {
          const p = data as Profile;
          setProfile(p);
          setForm({
            display_name: p.display_name || "",
            city: p.city || "",
            zip: p.zip || "",
            bio: p.bio || "",
            company: p.company || "",
            role: p.role || "Hobby farm",
            is_ranch: p.is_ranch || p.role === "Ranch / Farm",
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!hasSupabaseConfig()) {
      setError(MISSING_SUPABASE_ENV_MESSAGE);
      return;
    }
    if (!userId) {
      setError("Not signed in.");
      return;
    }

    const zipErr = form.zip ? usZipError(form.zip) : null;
    if (zipErr) {
      setError(zipErr);
      return;
    }
    if (!form.display_name.trim()) {
      setError("Display name is required.");
      return;
    }
    if (form.is_ranch && !form.company.trim()) {
      setError("Ranch or farm name is required for Ranch / Farm accounts.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      // Admin access comes from is_admin (server-only), never from the public
      // role label, so the client only ever writes Hobby farm or Ranch / Farm.
      const role = form.is_ranch ? "Ranch / Farm" : "Hobby farm";
      const profile_complete = Boolean(
        form.display_name.trim() && form.city.trim() && form.zip.trim()
      );

      const { data, error: err } = await supabase
        .from("profiles")
        .update({
            display_name: form.display_name.trim(),
            city: form.city.trim(),
            zip: form.zip.trim(),
            bio: form.bio.trim(),
            company: form.is_ranch ? form.company.trim() : "",
            role,
            is_ranch: form.is_ranch,
            profile_complete,
          })
        .eq("id", userId)
        .select("id");
      if (err) throw err;
      if (!data?.length) throw new Error("Save failed: profile not found.");
      const { data: fresh, error: freshErr } = await getMyProfile(supabase);
      if (freshErr) throw freshErr;
      setProfile(fresh);
      setOk(
        profile_complete
          ? "Profile saved."
          : "Saved. Add city and ZIP code to mark your profile complete."
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="wrap">
        <p className="muted">Loading account…</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="panel form-panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h2 className="account-title">Account</h2>
        <p className="help account-lead">
          Photo, city, and U.S. ZIP — editable anytime. Profile is complete when
          display name, city, and ZIP are set.
        </p>
        {error ? <div className="err">{error}</div> : null}
        {ok ? <div className="ok">{ok}</div> : null}

        {userId ? (
          <AvatarEditor
            userId={userId}
            name={form.display_name || profile?.display_name || userEmail || ""}
            url={profile?.avatar_url ?? null}
            onChange={(url) =>
              setProfile((p) => (p ? { ...p, avatar_url: url } : p))
            }
          />
        ) : null}

        <form onSubmit={onSave}>
          <div className="field">
            <label htmlFor="display_name">Display name</label>
            <input
              id="display_name"
              required
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="zip">ZIP code</label>
            <input
              id="zip"
              inputMode="numeric"
              maxLength={10}
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              placeholder="78701"
              autoComplete="postal-code"
            />
          </div>
          <div className="field">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div className="field check-row">
            <label>
              <input
                type="checkbox"
                checked={form.is_ranch}
                onChange={(e) =>
                  setForm({ ...form, is_ranch: e.target.checked })
                }
              />
              I run a working ranch or farm (self-reported)
            </label>
          </div>
          {form.is_ranch ? (
            <div className="field">
              <label htmlFor="company">Ranch or farm name</label>
              <input
                id="company"
                required={form.is_ranch}
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
          ) : null}
          <div className="actions">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
            <Link href="/my-listings" className="ghost">
              My listings
            </Link>
            <Link href="/billing" className="ghost">
              Billing
            </Link>
          </div>
        </form>
        <div className="stack" style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 0 }}>Email alerts</h3>
          <EmailToggles />
          <Link href="/alerts" className="ghost">
            Manage &quot;Looking for&quot; alerts
          </Link>
        </div>
        <DeleteAccount />
        <form action="/auth/signout" method="post" className="account-signout">
          <button className="ghost account-signout-btn" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
