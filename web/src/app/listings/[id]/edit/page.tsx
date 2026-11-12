"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { CATEGORIES, CATEGORY_HINTS, CONDITIONS, INTENTS } from "@/lib/constants";
import { usZipError } from "@/lib/us-zip";
import { LISTING_PHOTO_BUCKET } from "@/lib/listing-photos";
import ListingPhotoPicker, { MAX_LISTING_PHOTOS } from "@/components/ListingPhotoPicker";
import type { Listing, ListingPhoto } from "@/lib/types";

type Form = {
  title: string;
  category: string;
  intent: string;
  condition: string;
  description: string;
  looking_for: string;
  price: string;
  city: string;
  zip: string;
  pickup_ok: boolean;
  shipping_ok: boolean;
  scrap_bound: boolean;
  fast_window_hours: string;
};

const LIVE = ["Approved", "Claimed"];

function toForm(l: Listing): Form {
  return {
    title: l.title,
    category: l.category,
    intent: l.intent,
    condition: l.condition,
    description: l.description,
    looking_for: l.looking_for || "",
    price: String(l.price ?? 0),
    city: l.city,
    zip: l.zip,
    pickup_ok: l.pickup_ok,
    shipping_ok: l.shipping_ok,
    scrap_bound: l.scrap_bound,
    fast_window_hours: String(l.fast_window_hours ?? 24),
  };
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [photos, setPhotos] = useState<(ListingPhoto & { url: string | null })[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/auth?next=${encodeURIComponent(`/listings/${id}/edit`)}`);
        return;
      }
      const { data, error: e } = await supabase
        .from("listings")
        .select("*, listing_photos(*)")
        .eq("id", id)
        .maybeSingle();
      const l = data as Listing | null;
      if (e || !l) return setLoadErr("We couldn't find that listing.");
      if (l.poster_id !== user.id) return setLoadErr("Only the person who posted this listing can edit it.");
      if (l.status === "Deleted") return setLoadErr("This listing was deleted, so it can't be edited.");
      const ph = [...(l.listing_photos || [])].sort((a, b) => a.sort_order - b.sort_order);
      const signed = new Map<string, string>();
      if (ph.length) {
        const { data: s } = await supabase.storage
          .from(LISTING_PHOTO_BUCKET)
          .createSignedUrls(ph.map((p) => p.storage_path), 3600);
        for (const it of s || []) if (it.path && it.signedUrl) signed.set(it.path, it.signedUrl);
      }
      setPhotos(ph.map((p) => ({ ...p, url: signed.get(p.storage_path) ?? null })));
      setListing(l);
      setForm(toForm(l));
    })();
  }, [id, router]);

  const kept = photos.filter((p) => !removed.includes(p.id));
  const isLive = !!listing && LIVE.includes(listing.status);
  const contentChanged = useMemo(() => {
    if (!listing || !form) return false;
    const o = toForm(listing);
    return (
      form.title.trim() !== o.title ||
      form.description.trim() !== o.description ||
      form.category !== o.category ||
      form.condition !== o.condition ||
      form.looking_for.trim() !== o.looking_for ||
      removed.length > 0 ||
      files.length > 0
    );
  }, [listing, form, removed, files]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function removePhoto(photoId: string) {
    if (kept.length + files.length <= 1) {
      setError("Your listing needs at least one photo. Add a new photo before removing this one.");
      return;
    }
    if (!window.confirm("Delete this photo? It's removed when you save.")) return;
    setRemoved((r) => [...r, photoId]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!listing || !form) return;
    setError(null);
    const zipErr = usZipError(form.zip);
    if (zipErr) return setError(zipErr);
    if (!form.title.trim() || !form.city.trim()) return setError("Title and city are required.");
    if (kept.length + files.length < 1) return setError("Keep or add at least one photo.");
    if (
      isLive &&
      contentChanged &&
      !window.confirm(
        "These changes send your post back for a quick review. It will be hidden from Browse until it's approved again. Save anyway?"
      )
    )
      return;

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const price =
        form.intent === "Fast & Free" || form.intent === "Swap" ? 0 : Number(form.price) || 0;

      const { error: upErr } = await supabase
        .from("listings")
        .update({
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
        })
        .eq("id", listing.id);
      if (upErr) throw upErr;

      // Add new photos first so the listing never drops to zero photos.
      let order = Math.max(-1, ...photos.map((p) => p.sort_order)) + 1;
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${listing.id}/${Date.now()}-${order}.${ext}`;
        const { error: sErr } = await supabase.storage
          .from(LISTING_PHOTO_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
        if (sErr) throw sErr;
        const { error: pErr } = await supabase
          .from("listing_photos")
          .insert({ listing_id: listing.id, storage_path: path, public_url: null, sort_order: order++ });
        if (pErr) throw pErr;
      }

      for (const pid of removed) {
        const p = photos.find((x) => x.id === pid);
        if (!p) continue;
        const { error: dErr } = await supabase.from("listing_photos").delete().eq("id", pid);
        if (dErr) throw dErr;
        await supabase.storage.from(LISTING_PHOTO_BUCKET).remove([p.storage_path]);
      }

      router.push(`/listings/${listing.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your changes.");
      setSaving(false);
    }
  }

  if (loadErr) {
    return (
      <div className="wrap">
        <div className="panel empty">
          <p>{loadErr}</p>
          <Link href="/my-listings" className="primary">My listings</Link>
        </div>
      </div>
    );
  }
  if (!form || !listing) {
    return (
      <div className="wrap">
        <div className="panel empty">Loading…</div>
      </div>
    );
  }

  const room = MAX_LISTING_PHOTOS - kept.length;

  return (
    <div className="wrap">
      <Link href={`/listings/${listing.id}`} className="back-link">← Back to listing</Link>
      <div className="panel form-panel" style={{ maxWidth: 640, margin: "12px auto 0" }}>
        <h2 style={{ marginTop: 0 }}>Edit post</h2>
        {isLive ? (
          <div className="warn" style={{ marginBottom: 12 }}>
            Heads up: changing the title, description, category, condition, &ldquo;looking for&rdquo; or
            photos sends your post back for a quick review. It&apos;s hidden from Browse until
            it&apos;s approved again. Price, location and pickup changes stay live.
          </div>
        ) : listing.status === "Rejected" ? (
          <div className="warn" style={{ marginBottom: 12 }}>
            Fix what was flagged{listing.reject_reason ? ` (“${listing.reject_reason}”)` : ""} and save to send it back for review.
          </div>
        ) : null}
        {error ? <div className="err">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" required value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {CATEGORY_HINTS[form.category as (typeof CATEGORIES)[number]] ? (
                <p className="help">{CATEGORY_HINTS[form.category as (typeof CATEGORIES)[number]]}</p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="intent">Intent</label>
              <select id="intent" value={form.intent} onChange={(e) => set("intent", e.target.value)}>
                {INTENTS.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="condition">Condition</label>
              <select id="condition" value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" rows={4} required value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="looking_for">Looking for (swaps)</label>
            <input id="looking_for" value={form.looking_for} onChange={(e) => set("looking_for", e.target.value)} />
          </div>
          {form.intent === "Sell" || form.intent === "Sell or Swap" ? (
            <div className="field">
              <label htmlFor="price">Price (USD)</label>
              <input id="price" type="number" min="0" step="1" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
          ) : null}
          {form.intent === "Fast & Free" ? (
            <div className="field">
              <label htmlFor="fast">Fast &amp; Free window (hours after approve)</label>
              <input id="fast" type="number" min="1" value={form.fast_window_hours} onChange={(e) => set("fast_window_hours", e.target.value)} />
            </div>
          ) : null}
          <div className="field-grid">
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" required value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="zip">ZIP code</label>
              <input id="zip" required inputMode="numeric" pattern="\d{5}(-\d{4})?" maxLength={10} value={form.zip} onChange={(e) => set("zip", e.target.value)} autoComplete="postal-code" />
            </div>
          </div>
          <div className="field check-row">
            <label><input type="checkbox" checked={form.pickup_ok} onChange={(e) => set("pickup_ok", e.target.checked)} /> Pickup OK</label>
            <label><input type="checkbox" checked={form.shipping_ok} onChange={(e) => set("shipping_ok", e.target.checked)} /> Shipping OK</label>
            <label><input type="checkbox" checked={form.scrap_bound} onChange={(e) => set("scrap_bound", e.target.checked)} /> Headed for scrap</label>
          </div>

          <div className="field">
            <label>Current photos</label>
            <ul className="edit-photos">
              {kept.map((p) => (
                <li key={p.id}>
                  <div className="thumb edit-photo-thumb" style={{ backgroundImage: p.url ? `url(${p.url})` : undefined }} />
                  <button type="button" className="danger edit-photo-del" onClick={() => removePhoto(p.id)} disabled={saving}>
                    Delete photo
                  </button>
                </li>
              ))}
            </ul>
            {removed.length ? (
              <p className="help">
                {removed.length} photo{removed.length === 1 ? "" : "s"} will be deleted when you save.{" "}
                <button type="button" className="ghost" onClick={() => setRemoved([])}>Undo</button>
              </p>
            ) : null}
          </div>
          {room > 0 ? (
            <div className="field">
              <label>Add new photos (camera)</label>
              <ListingPhotoPicker files={files} onChange={setFiles} disabled={saving} max={room} />
            </div>
          ) : (
            <p className="help">You have the max of {MAX_LISTING_PHOTOS} photos. Delete one to add another.</p>
          )}

          {isLive && contentChanged ? (
            <div className="warn" style={{ marginBottom: 12 }}>
              Saving these changes sends your post back for review. It&apos;ll be off Browse until approved.
            </div>
          ) : null}
          <div className="actions edit-actions">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : isLive && contentChanged ? "Save & send for review" : "Save changes"}
            </button>
            <Link href={`/listings/${listing.id}`} className="ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
