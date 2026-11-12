"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "Resolved" | "Dismissed") {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.from("reports").update({ status }).eq("id", reportId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="actions">
      <button
        className="primary"
        type="button"
        disabled={busy}
        onClick={() => setStatus("Resolved")}
      >
        Resolve
      </button>
      <button
        className="ghost"
        type="button"
        disabled={busy}
        onClick={() => setStatus("Dismissed")}
      >
        Dismiss
      </button>
    </div>
  );
}
