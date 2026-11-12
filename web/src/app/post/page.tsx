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
import { ACTIVE_STATUSES, CATEGORIES, CATEGORY_HINTS, CONDITIONS, INTENTS } from "@/lib/constants";
import { usZipError } from "@/lib/us-zip";
import { FREE_LISTING_CAP, listingCapForPlan } from "@/lib/billing";
import ListingPhotoPicker, { MAX_LISTING_PHOTOS } from "@/components/ListingPhotoPicker";
import { AuthBrand } from "@/components/AuthBrand";

export default function PostPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [capBlocked, setCapBlocked] = useState(false);
  const [capInfo, setCapInfo] = useState<{ active: number; cap: number } | null>(
    null
  );

  const [form, setForm] = useState({
    title: "",
    category: CATEGORIES[0] as string,
    intent: INTENTS[0] as string,
    condition: CONDITIONS[2] as string,
    description: "",
    looking_for: "",
    price: "0",
    city: "",
    zip: "",
    pickup_ok: true,
    shipping_ok: false,
    scrap_bound: false,
    fast_window_hours: "24",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!hasSupabaseConfig()) {
          if (!cancelled) setAuthChecked(true);
          return;
        }
        const user = await resolveClientUser();
        if (cancelled) return;
        if (!user) {
          setNeedsAuth(true);
          setAuthChecked(true);
          return;
        }
        setAuthChecked(true);
      } catch {
        if (cancelled) return;
        setNeedsAuth(true);
        setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasSupabaseConfig()) {
      setError(MISSING_SUPABASE_ENV_MESSAGE);
      return;
    }

    const zipErr = usZipError(form.zip);
    if (zipErr) {
      setError(zipErr);
      return;
    }
    if (!form.title.trim() || !form.city.trim()) {
      setError("Title and city are required.");
      return;
    }
    if (files.length < 1) {
      setError("Take at least one photo of the item (up to 6). Photos are required for listings.");
      return;
    }

    setLoading(true);
    let createdListingId: string | null = null;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }

      const { data: profile } = await getMyProfile(supabase);

      const { count: activeCount, error: countErr } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("poster_id", user.id)
        .in("status", [...ACTIVE_STATUSES]);
      if (countErr) throw countErr;

      const cap = listingCapForPlan(profile?.plan, profile?.plan_status);
      const active = activeCount ?? 0;
      setCapInfo({ active, cap });
      if (active >= cap) {
        setCapBlocked(true);
        setError(
          `You've reached your active listing limit (${active}/${cap}). Upgrade on Billing to post more.`
        );
        setLoading(false);
        return;
      }
      setCapBlocked(false);

      const price =
        form.intent === "Fast & Free" || form.intent === "Swap"
          ? 0
          : Number(form.price) || 0;

      const { data: listing, error: insertErr } = await supabase
        .from("listings")
        .insert({
          poster_id: user.id,
          title: form.title.trim(),
          category: form.category,
          intent: form.intent,
          condition: form.condition,
          description: form.description.trim(),
          looking_for: form.looking_for.trim(),
          price,
          city: form.city.trim(),
          zip: form.zip.trim(),
          pickup_ok: form.pickup_ok,
          shipping_ok: form.shipping_ok,
          scrap_bound: form.scrap_bound,
          fast_window_hours: Number(form.fast_window_hours) || 24,
          status: "Pending Review",
        })
        .select("id")
        .single();
      if (insertErr) {
        // Server-side cap (DB trigger listings_enforce_cap) is authoritative.
        if (insertErr.message?.includes("listing_cap_reached")) {
          setCapBlocked(true);
          setError(
            "You've reached your active listing limit. Upgrade on Billing to post more."
          );
          setLoading(false);
          return;
        }
        throw insertErr;
      }
      createdListingId = listing.id;

      const max = Math.min(files.length, MAX_LISTING_PHOTOS);
      for (let i = 0; i < max; i++) {
        const file = files[i];
        const ext = (file.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/${listing.id}/${i}.${ext || "jpg"}`;
        const { error: upErr } = await supabase.storage
          .from("listing-photos")
          .upload(path, file, {
            upsert: true,
            contentType: file.type || "image/jpeg",
          });
        if (upErr) throw upErr;
        const { error: photoErr } = await supabase.from("listing_photos").insert({
          listing_id: listing.id,
          storage_path: path,
          // Bucket is private; pages sign storage_path on render.
          public_url: null,
          sort_order: i,
        });
        if (photoErr) throw photoErr;
      }

      router.push("/my-listings");
      router.refresh();
    } catch (err) {
      if (createdListingId && hasSupabaseConfig()) {
        try {
          const supabase = createClient();
          await supabase.from("listings").delete().eq("id", createdListingId);
        } catch {
          // best-effort rollback so we don't leave photo-less pending listings
        }
      }
      setError(err instanceof Error ? err.message : "Failed to post listing");
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="wrap">
        <div className="panel empty">Checking sign-in…</div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="wrap">
        <AuthBrand lead="Create a free account or sign in. We'll bring you right back to this form.">
          <div className="panel auth-panel" style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>Sign in to post a listing</h2>
            <div className="actions" style={{ justifyContent: "center" }}>
              <Link
                href="/auth?next=%2Fpost&reason=post"
                className="primary"
              >
                Sign in
              </Link>
              <Link
                href="/auth?mode=signup&next=%2Fpost&reason=post"
                className="ghost"
              >
                Create account
              </Link>
            </div>
          </div>
        </AuthBrand>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="panel form-panel" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ marginTop: 0 }}>Post a listing</h2>
        <p className="help">
          Listings start as <strong>Pending Review</strong>. Admins approve before
          they appear on Browse.
        </p>
        {!hasSupabaseConfig() ? (
          <div className="err">{MISSING_SUPABASE_ENV_MESSAGE}</div>
        ) : null}
        {error ? <div className="err">{error}</div> : null}
        {capBlocked ? (
          <div className="warn" style={{ marginBottom: 12 }}>
            {capInfo && capInfo.cap > FREE_LISTING_CAP
              ? `Your plan allows ${capInfo.cap} active listings (you have ${capInfo.active}/${capInfo.cap}).`
              : `Free tier is ${FREE_LISTING_CAP} active listings${
                  capInfo ? ` (you have ${capInfo.active}/${capInfo.cap})` : ""
                }.`}
            {" "}
            <Link href="/billing" className="primary" style={{ marginLeft: 8 }}>
              Upgrade on Billing
            </Link>
          </div>
        ) : null}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="6' box blade, Category I"
            />
          </div>
          <div className="field-grid">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {CATEGORY_HINTS[form.category as (typeof CATEGORIES)[number]] ? (
              <p className="help">{CATEGORY_HINTS[form.category as (typeof CATEGORIES)[number]]}</p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="intent">Intent</label>
            <select
              id="intent"
              value={form.intent}
              onChange={(e) => set("intent", e.target.value)}
            >
              {INTENTS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="condition">Condition</label>
            <select
              id="condition"
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
            >
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={4}
              required
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="looking_for">Looking for (swaps)</label>
            <input
              id="looking_for"
              value={form.looking_for}
              onChange={(e) => set("looking_for", e.target.value)}
              placeholder="Hay, T-posts, a stock trailer…"
            />
          </div>
          {form.intent === "Sell" || form.intent === "Sell or Swap" ? (
            <div className="field">
              <label htmlFor="price">Price (USD)</label>
              <input
                id="price"
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </div>
          ) : null}
          {form.intent === "Fast & Free" ? (
            <div className="field">
              <label htmlFor="fast">Fast & Free window (hours after approve)</label>
              <input
                id="fast"
                type="number"
                min="1"
                value={form.fast_window_hours}
                onChange={(e) => set("fast_window_hours", e.target.value)}
              />
              <p className="help">Timer starts when an admin approves.</p>
            </div>
          ) : null}
          <div className="field-grid">
          <div className="field">
            <label htmlFor="city">City</label>
            <input
              id="city"
              required
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="zip">ZIP code</label>
            <input
              id="zip"
              required
              inputMode="numeric"
              pattern="\d{5}(-\d{4})?"
              maxLength={10}
              value={form.zip}
              onChange={(e) => set("zip", e.target.value)}
              placeholder="78701"
              autoComplete="postal-code"
            />
          </div>
          </div>
          <div className="field check-row">
            <label>
              <input
                type="checkbox"
                checked={form.pickup_ok}
                onChange={(e) => set("pickup_ok", e.target.checked)}
              />
              Pickup OK
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.shipping_ok}
                onChange={(e) => set("shipping_ok", e.target.checked)}
              />
              Shipping OK
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.scrap_bound}
                onChange={(e) => set("scrap_bound", e.target.checked)}
              />
              Headed for scrap
            </label>
          </div>
          <div className="field">
            <label htmlFor="photos">Photos (required, up to {MAX_LISTING_PHOTOS})</label>
            <ListingPhotoPicker files={files} onChange={setFiles} disabled={loading} />
          </div>
          <div className="actions">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Posting…" : "Submit for review"}
            </button>
            <Link href="/browse" className="ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
