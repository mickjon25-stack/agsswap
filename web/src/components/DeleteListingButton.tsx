"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteListingButton({
  listingId,
  title,
  compact = false,
}: {
  listingId: string;
  title: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      `Delete “${title}”?\n\nIt will disappear from Browse right away. This can’t be undone.`
    );
    if (!ok) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/listings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't delete this listing.");
      router.refresh();
      router.push("/my-listings");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this listing.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="danger"
        onClick={onDelete}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Deleting…" : compact ? "Delete" : "Delete listing"}
      </button>
      {error ? <div className="err" style={{ marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
