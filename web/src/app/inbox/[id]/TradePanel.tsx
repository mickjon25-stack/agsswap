"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LeaveReviewForm } from "@/components/LeaveReviewForm";

export type TradeInfo = {
  id: string;
  status: "Pending" | "Confirmed" | "Cancelled";
  requested_by: string;
} | null;

export function TradePanel({
  threadId,
  userId,
  otherId,
  otherName,
  trade,
  myReview,
}: {
  threadId: string;
  userId: string;
  otherId: string;
  otherName: string;
  trade: TradeInfo;
  myReview: { stars: number; comment: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "mark" | "cancel" | "confirm" | "decline" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: "mark" | "cancel" | "confirm" | "decline",
    fn: () => PromiseLike<{ data?: unknown; error: { message: string } | null }>
  ) {
    if (busy) return;
    setBusy(true);
    setBusyAction(action);
    setError(null);
    try {
      const { error: err } = await fn();
      if (err) throw new Error(err.message);
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Something went wrong";
      setError(
        /row-level security|permission denied|42501/i.test(raw)
          ? "Couldn't save your review. Try again, or open this conversation from Inbox → Trade & review."
          : raw
      );
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  const supabase = createClient();


  let body: React.ReactNode;
  if (!trade || trade.status === "Cancelled") {
    body = (
      <>
        <p className="help" style={{ marginTop: 0 }}>
          Finished the swap or sale? Tap below. We&apos;ll email {otherName} to
          confirm in this chat — <strong>after they confirm, you can rate them
          here</strong> (1–5 stars). You rate the person, not the listing.
        </p>
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={() =>
            run("mark", async () => {
              const res = await supabase.rpc("request_trade_complete", { p_thread_id: threadId });
              if (!res.error && res.data) {
                await fetch("/api/notify/trade", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ tradeId: res.data, event: "requested" }),
                }).catch(() => {});
              }
              return res;
            })
          }
          aria-busy={busyAction === "mark"}
        >
          {busyAction === "mark" ? "Marking…" : "Mark trade complete"}
        </button>
      </>
    );
  } else if (trade.status === "Pending" && trade.requested_by === userId) {
    body = (
      <>
        <p className="help" style={{ marginTop: 0 }}>
          Waiting for <strong>{otherName}</strong> to tap &quot;Yes, confirm
          trade&quot; in their Inbox (we emailed them). Reviews unlock only
          after they confirm.
        </p>
        <button
          className="ghost"
          type="button"
          disabled={busy}
          onClick={() =>
            run("cancel", () =>
              supabase.rpc("respond_trade_complete", { p_trade_id: trade.id, p_accept: false })
            )
          }
          aria-busy={busyAction === "cancel"}
        >
          {busyAction === "cancel" ? "Cancelling…" : "Cancel request"}
        </button>
      </>
    );
  } else if (trade.status === "Pending") {
    body = (
      <>
        <p className="help" style={{ marginTop: 0 }}>
          {otherName} says this trade is complete. Is that right?
        </p>
        <div className="actions">
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={() =>
              run("confirm", async () => {
                const res = await supabase.rpc("respond_trade_complete", {
                  p_trade_id: trade.id,
                  p_accept: true,
                });
                if (!res.error) {
                  await fetch("/api/notify/trade", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tradeId: trade.id, event: "confirmed" }),
                  }).catch(() => {});
                }
                return res;
              })
            }
            aria-busy={busyAction === "confirm"}
          >
            {busyAction === "confirm" ? "Confirming…" : "Yes, confirm trade"}
          </button>
          <button
            className="ghost"
            type="button"
            disabled={busy}
            onClick={() =>
              run("decline", () =>
                supabase.rpc("respond_trade_complete", { p_trade_id: trade.id, p_accept: false })
              )
            }
            aria-busy={busyAction === "decline"}
          >
            {busyAction === "decline" ? "Updating…" : "Not yet"}
          </button>
        </div>
      </>
    );
  } else if (myReview) {
    body = (
      <p className="help" style={{ marginTop: 0 }}>
        Trade confirmed. You gave {otherName} {"⭐".repeat(myReview.stars)}
        {myReview.comment ? ` — “${myReview.comment}”` : ""}. Reviews show on
        profiles once you both review, or after 7 days.
      </p>
    );
  } else {
    body = (
      <LeaveReviewForm
        tradeId={trade!.id}
        reviewerId={userId}
        revieweeId={otherId}
        revieweeName={otherName}
      />
    );
  }

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Trade &amp; review</h3>
      {error ? <div className="err">{error}</div> : null}
      {body}
    </div>
  );
}
