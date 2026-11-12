"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ReportForm({
  listingId,
  reportedUserId,
}: {
  listingId: string;
  reportedUserId: string;
}) {
  const [reason, setReason] = useState("Spam / junk");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      const { error: err } = await supabase.from("reports").insert({
        reporter_id: user.id,
        listing_id: listingId,
        reported_user_id: reportedUserId,
        reason,
        details,
        status: "Pending",
      });
      if (err) throw err;
      setOk(true);
      setDetails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? <div className="err">{error}</div> : null}
      {ok ? <div className="ok">Thanks — admins will review.</div> : null}
      <div className="field">
        <label htmlFor="reason">Reason</label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option>Spam / junk</option>
          <option>Scam / fraud</option>
          <option>Wrong category / not farm or ranch</option>
          <option>Unsafe / harassment</option>
          <option>Other</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="details">Details</label>
        <textarea
          id="details"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>
      <button className="danger" type="submit" disabled={loading}>
        {loading ? "Sending…" : "Submit report"}
      </button>
    </form>
  );
}
