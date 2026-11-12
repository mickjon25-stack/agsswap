"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ReplyForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write a message first.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      const { error: insertErr } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: user.id,
        body: trimmed,
      });
      if (insertErr) throw insertErr;
      // Email the other person (server throttles + checks prefs). Best effort.
      void fetch("/api/notify/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      }).catch(() => {});

      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="reply-form">
      {error ? <div className="err">{error}</div> : null}
      <div className="field">
        <label htmlFor="reply-body">Reply</label>
        <textarea
          id="reply-body"
          rows={3}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Continue the conversation…"
        />
      </div>
      <button className="primary" type="submit" disabled={loading}>
        {loading ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
