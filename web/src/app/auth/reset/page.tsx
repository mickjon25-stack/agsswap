"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resolveClientUser } from "@/lib/supabase/client-auth";
import { friendlyAuthError } from "@/lib/auth-messages";

/** Landing page for password-reset links (via /auth/callback?next=/auth/reset, or Site URL + #type=recovery). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // Hash tokens may still be processing (AuthHashHandler) when we first mount.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED"))) {
        if (session) setReady("ok");
      }
    });

    (async () => {
      // Give the hash handler a moment, then probe.
      for (const wait of [0, 400, 900, 1600]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        try {
          const u = await resolveClientUser({ timeoutMs: 2500 });
          if (u) { setReady("ok"); return; }
        } catch { /* keep trying */ }
      }
      if (!cancelled) setReady("no-session");
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const pw = String(form.get("password") ?? "") || password;
    const pw2 = String(form.get("confirm") ?? "") || confirm;
    if (pw.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (pw !== pw2) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const { error: err } = await createClient().auth.updateUser({ password: pw });
      if (err) throw err;
      setSaved(true);
      setTimeout(() => {
        router.push("/account");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="panel auth-panel">
        <h2 style={{ marginTop: 0 }}>Set a new password</h2>
        {ready === "checking" ? <p className="muted">Checking your reset link…</p> : null}
        {ready === "no-session" ? (
          <div className="err">
            This reset link has expired or was opened on a different device.{" "}
            <Link href="/auth?mode=reset">Request a new one</Link>.
          </div>
        ) : null}
        {ready === "ok" && saved ? (
          <div className="ok" role="status">Password updated. Taking you to your account…</div>
        ) : null}
        {ready === "ok" && !saved ? (
          <form onSubmit={onSubmit}>
            {error ? <div className="err" role="alert">{error}</div> : null}
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onInput={(e) => setPassword(e.currentTarget.value)}
              />
              <p className="help">At least 6 characters.</p>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onInput={(e) => setConfirm(e.currentTarget.value)}
              />
            </div>
            <button className="primary auth-submit" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
