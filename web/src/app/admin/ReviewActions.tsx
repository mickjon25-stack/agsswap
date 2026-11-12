"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ReviewActions({
  reviewId,
  hidden,
  reportIds,
}: {
  reviewId: string;
  hidden: boolean;
  reportIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(kind: "hide" | "show" | "remove" | "dismiss") {
    if (kind === "remove" && !window.confirm("Remove this review for good?")) return;
    setBusy(true);
    try {
      const supabase = createClient();
      if (kind === "remove") {
        await supabase.from("reviews").delete().eq("id", reviewId);
      } else if (kind === "hide" || kind === "show") {
        await supabase.from("reviews").update({ hidden: kind === "hide" }).eq("id", reviewId);
      }
      if (reportIds.length && kind !== "show") {
        await supabase
          .from("review_reports")
          .update({ status: kind === "dismiss" ? "Dismissed" : "Resolved" })
          .in("id", reportIds);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="actions">
      <button className="ghost" type="button" disabled={busy} onClick={() => act(hidden ? "show" : "hide")}>
        {hidden ? "Unhide" : "Hide"}
      </button>
      <button className="danger" type="button" disabled={busy} onClick={() => act("remove")}>
        Remove
      </button>
      {reportIds.length ? (
        <button className="ghost" type="button" disabled={busy} onClick={() => act("dismiss")}>
          Keep (dismiss report)
        </button>
      ) : null}
    </div>
  );
}
