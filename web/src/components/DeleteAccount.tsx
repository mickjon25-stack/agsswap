"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: text }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Couldn't delete your account.");
      await createClient().auth.signOut().catch(() => undefined);
      window.location.replace("/account-deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <div className="stack account-danger">
      <h3 style={{ marginBottom: 0 }}>Delete account</h3>
      {!open ? (
        <div>
          <button type="button" className="danger" onClick={() => setOpen(true)}>
            Delete account
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="err">
            This permanently deletes your account. Your listings, photos, alerts and settings
            are removed and can&apos;t be recovered. People you messaged keep their side of
            the conversation, and you&apos;ll show as &quot;Deleted member&quot;.
          </div>
          <div className="field">
            <label htmlFor="confirm-delete">Type DELETE to confirm</label>
            <input
              id="confirm-delete"
              autoComplete="off"
              autoCapitalize="characters"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {error ? <div className="err">{error}</div> : null}
          <div className="actions">
            <button type="button" className="danger" disabled={text !== "DELETE" || busy} onClick={onDelete}>
              {busy ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => { setOpen(false); setText(""); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
