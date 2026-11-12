"use client";

import { useState } from "react";
import { BUMP_PRICE_LABEL, isRecentlyBumped } from "@/lib/billing";

export function BumpButton({
  listingId,
  bumpedAt,
}: {
  listingId: string;
  bumpedAt?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = isRecentlyBumped(bumpedAt);

  async function onBump() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "bump", listingId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start boost checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Boost failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="ghost"
        onClick={onBump}
        disabled={loading}
        title={
          active
            ? "Already boosted — you can boost again to refresh the 7-day window"
            : `Boost this listing to the top of Browse for 7 days (${BUMP_PRICE_LABEL})`
        }
      >
        {loading
          ? "Redirecting…"
          : active
            ? `Refresh boost (${BUMP_PRICE_LABEL})`
            : `Boost listing (${BUMP_PRICE_LABEL})`}
      </button>
      {error ? <div className="err" style={{ marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
