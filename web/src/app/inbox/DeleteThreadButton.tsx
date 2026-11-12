"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** "Delete for me": hides the conversation from your inbox only. */
export function DeleteThreadButton({
  threadId,
  redirectTo,
  compact = false,
}: {
  threadId: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!window.confirm("Delete this conversation? It will be removed from your inbox only.")) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");
      // Replace any earlier hide so hidden_at uses the server's clock (now()).
      await supabase.from("thread_hides").delete().eq("user_id", user.id).eq("thread_id", threadId);
      const { error: insErr } = await supabase
        .from("thread_hides")
        .insert({ user_id: user.id, thread_id: threadId });
      if (insErr) throw insErr;
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <span className="delete-thread">
      <button
        type="button"
        className={compact ? "ghost delete-thread-btn compact" : "danger delete-thread-btn"}
        onClick={onClick}
        disabled={busy}
        aria-label="Delete conversation"
      >
        {busy ? "Deleting…" : compact ? "Delete" : "Delete conversation"}
      </button>
      {error ? <span className="err" style={{ display: "block", marginTop: 6 }}>{error}</span> : null}
    </span>
  );
}
