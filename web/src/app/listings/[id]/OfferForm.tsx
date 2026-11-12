"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LISTING_PHOTO_BUCKET } from "@/lib/listing-photos";

type MyListing = { id: string; title: string; photo: string | null };

export function OfferForm({ listingId, allowSwap = true }: { listingId: string; allowSwap?: boolean }) {
  const router = useRouter();
  const [mine, setMine] = useState<MyListing[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!allowSwap) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setMine([]); return; }
      const { data } = await supabase
        .from("listings")
        .select("id, title, listing_photos(storage_path, sort_order)")
        .eq("poster_id", user.id)
        .eq("status", "Approved")
        .neq("id", listingId)
        .order("created_at", { ascending: false });
      const rows = (data as { id: string; title: string; listing_photos: { storage_path: string; sort_order: number }[] | null }[] | null) || [];
      const firstPath = (r: (typeof rows)[number]) =>
        (r.listing_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
      const paths = rows.map(firstPath).filter((x): x is string => !!x);
      const signed = new Map<string, string>();
      if (paths.length) {
        const { data: urls } = await supabase.storage.from(LISTING_PHOTO_BUCKET).createSignedUrls(paths, 3600);
        for (const u of urls || []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
      }
      if (!cancelled)
        setMine(rows.map((r) => ({ id: r.id, title: r.title, photo: signed.get(firstPath(r) || "") ?? null })));
    })().catch(() => { if (!cancelled) setMine([]); });
    return () => { cancelled = true; };
  }, [allowSwap, listingId]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current || loading || threadId) return;
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Write a message first.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      const { data: listing, error: listingErr } = await supabase
        .from("listings")
        .select("poster_id")
        .eq("id", listingId)
        .single();
      if (listingErr) throw listingErr;
      if (!listing) throw new Error("Listing not found");
      if (listing.poster_id === user.id) {
        throw new Error("You can't offer on your own listing");
      }

      // Reuse an existing thread for this listing + counterparty when present.
      const { data: existingThreads } = await supabase
        .from("threads")
        .select("id, participant_a, participant_b")
        .eq("listing_id", listingId)
        .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`);

      const existing = (existingThreads || []).find(
        (t) =>
          (t.participant_a === user.id &&
            t.participant_b === listing.poster_id) ||
          (t.participant_b === user.id && t.participant_a === listing.poster_id)
      );
      let openThreadId = existing?.id as string | undefined;

      const { data: offer, error: offerErr } = await supabase
        .from("offers")
        .insert({
          listing_id: listingId,
          from_user_id: user.id,
          message: trimmed,
          status: "Pending",
          offered_listing_id: picked[0] ?? null,
        })
        .select("id")
        .single();
      if (offerErr) throw offerErr;

      if (picked.length) {
        const { error: linkErr } = await supabase
          .from("offer_listings")
          .insert(picked.map((lid) => ({ offer_id: offer.id, listing_id: lid })));
        if (linkErr) throw new Error("Couldn't attach your listing(s): " + linkErr.message);
      }

      if (!openThreadId) {
        const { data: thread, error: threadErr } = await supabase
          .from("threads")
          .insert({
            listing_id: listingId,
            offer_id: offer.id,
            participant_a: user.id,
            participant_b: listing.poster_id,
          })
          .select("id")
          .single();
        if (threadErr) throw threadErr;
        openThreadId = thread.id;
      }

      if (!openThreadId) throw new Error("Could not open message thread");

      const { error: msgErr } = await supabase.from("messages").insert({
        thread_id: openThreadId,
        sender_id: user.id,
        body: picked.length
          ? `${trimmed}\n\n🔁 Offering in swap: ${(mine || []).filter((m) => picked.includes(m.id)).map((m) => m.title).join(", ")}`
          : trimmed,
      });
      if (msgErr) throw msgErr;
      // Email the poster about the offer (server-side, throttled). Best effort.
      await fetch("/api/notify/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: openThreadId }),
      }).catch(() => {});

      // Clear so a second accidental send is hard; stay put so the confirmation stays visible.
      setMessage("");
      setPicked([]);
      setThreadId(openThreadId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send offer");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? <div className="err">{error}</div> : null}
      {threadId ? (
        <div className="ok">
          Offer sent.{" "}
          <Link href={`/inbox/${threadId}`}>Open conversation</Link> or{" "}
          <Link href="/inbox">view inbox</Link>.
        </div>
      ) : null}
      {allowSwap ? (
        <div className="field">
          <label>Offer one of your listings in swap (optional)</label>
          {mine === null ? (
            <div className="help">Loading your listings…</div>
          ) : mine.length === 0 ? (
            <div className="help">
              You have no active listings to offer. <Link href="/post">Post one</Link> — once it&apos;s
              approved you can attach it here. You can still send a message.
            </div>
          ) : (
            <ul className="pick-list">
              {mine.map((m) => {
                const on = picked.includes(m.id);
                return (
                  <li key={m.id}>
                    <label className={`pick-item ${on ? "on" : ""}`}>
                      <input type="checkbox" checked={on} disabled={loading || !!threadId} onChange={() => toggle(m.id)} />
                      {m.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photo} alt="" className="linked-thumb" />
                      ) : (
                        <span className="linked-thumb linked-thumb-empty" aria-hidden>📦</span>
                      )}
                      <span className="linked-title">{m.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="offer-msg">Message</label>
        <textarea
          id="offer-msg"
          rows={4}
          required
          disabled={loading || !!threadId}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="I'd swap a round bale and some T-posts for this…"
        />
      </div>
      <button className="primary cta" type="submit" disabled={loading || !!threadId} aria-busy={loading}>
        {loading
          ? "Sending…"
          : threadId
            ? "Offer sent"
            : picked.length
              ? `Send swap offer (${picked.length})`
              : "Send offer"}
      </button>
    </form>
  );
}
