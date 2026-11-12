"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ReportReview({ reviewId, userId }: { reviewId: string; userId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function report() {
    const reason = window.prompt("What's wrong with this review?") ?? null;
    if (reason === null) return;
    setState("busy");
    const { error } = await createClient()
      .from("review_reports")
      .insert({ review_id: reviewId, reporter_id: userId, reason: reason.slice(0, 500) });
    setState(error && !error.message.includes("duplicate") ? "error" : "done");
  }
  if (state === "done") return <span className="help">Reported. Thanks.</span>;
  return (
    <button className="ghost" type="button" style={{ fontSize: "0.8rem", padding: "2px 8px" }} disabled={state === "busy"} onClick={report}>
      {state === "error" ? "Try again" : "Report"}
    </button>
  );
}
