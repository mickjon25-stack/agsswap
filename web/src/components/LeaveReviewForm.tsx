"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Shared 1–5 star + comment form for a confirmed trade partner. */
export function LeaveReviewForm({
  tradeId,
  reviewerId,
  revieweeId,
  revieweeName,
}: {
  tradeId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
}) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (stars < 1) {
      setError("Pick 1 to 5 stars.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await createClient().from("reviews").insert({
        trade_id: tradeId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        stars,
        comment: comment.trim().slice(0, 500),
      });
      if (err) throw err;
      setDone(true);
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        /row-level security|permission denied|42501/i.test(raw)
          ? "Couldn't save your review. Make sure the trade is confirmed in Inbox, then try again."
          : raw
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ok" role="status">
        Thanks — your review of {revieweeName} was saved. It shows on their
        profile once they review you too, or after 7 days.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? <div className="err" role="alert">{error}</div> : null}
      <p className="help" style={{ marginTop: 0 }}>
        How did the swap go with {revieweeName}? You rate the person (not the
        product). They won&apos;t see this until they leave one too, or after 7
        days.
      </p>
      <div className="star-picker" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= stars ? "on" : ""}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-checked={n === stars}
            role="radio"
            onClick={() => setStars(n)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`review-comment-${tradeId}`}>Comment (optional)</label>
        <textarea
          id={`review-comment-${tradeId}`}
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Showed up on time, item was as pictured."
        />
      </div>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Post review"}
      </button>
    </form>
  );
}
