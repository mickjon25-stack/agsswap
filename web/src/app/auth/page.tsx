"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  hasSupabaseConfig,
  MISSING_SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";
import { friendlyAuthError } from "@/lib/auth-messages";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { authReasonNotice, safeAuthNext } from "@/lib/auth-next";
import { AuthBrand } from "@/components/AuthBrand";

type Mode = "signin" | "signup" | "reset";
/** Screens shown instead of the form after an email was (or wasn't) sent. */
type Done =
  | { kind: "confirm"; email: string }
  | { kind: "exists"; email: string }
  | { kind: "reset"; email: string }
  | null;

async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string | undefined,
  displayName: string
) {
  await supabase.from("profiles").upsert(
    {
      id: userId,
      email: email ?? null,
      display_name: displayName,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => {
    const m = searchParams.get("mode");
    if (m === "signup") return "signup";
    if (m === "reset") return "reset";
    return "signin";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [done, setDone] = useState<Done>(null);
  const [showResend, setShowResend] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const configured = hasSupabaseConfig();
  const nextPath = safeAuthNext(searchParams.get("next"), "/browse");

  useEffect(() => {
    const q = searchParams.get("error");
    // Magic-link tokens in the #fragment are being handled by AuthHashHandler.
    const hashLogin =
      typeof window !== "undefined" && window.location.hash.includes("access_token=");
    if (q && !(q === "missing_code" && hashLogin)) {
      setError(
        q === "not_configured"
          ? MISSING_SUPABASE_ENV_MESSAGE
          : q === "missing_code"
            ? "That sign-in link is incomplete or has expired. Please sign in, or request a new link."
            : friendlyAuthError(decodeURIComponent(q))
      );
    }
    const why = authReasonNotice(searchParams.get("reason"));
    if (why) setNotice(why);
  }, [searchParams]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setNotice(authReasonNotice(searchParams.get("reason")));
    setShowResend(false);
    setDone(null);
  }

  async function resendConfirmation(address: string) {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeAuthNext(searchParams.get("next"), "/account"))}`,
        },
      });
      if (err) throw err;
      setNotice(`Sent another confirmation email to ${address}.`);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    setError(null);
    setNotice(null);
    setShowResend(false);

    // Read the live form values as a fallback for browser/automation fills that
    // update the DOM before React receives the corresponding input event.
    const formData = new FormData(e.currentTarget);
    const currentEmail = (String(formData.get("email") ?? "") || email).trim();
    const currentPassword = String(formData.get("password") ?? "") || password;
    const currentDisplayName =
      String(formData.get("displayName") ?? "") || displayName;
    setEmail(currentEmail);
    setPassword(currentPassword);
    setDisplayName(currentDisplayName);

    if (!configured) {
      setError(MISSING_SUPABASE_ENV_MESSAGE);
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;

      if (mode === "reset") {
        // Prefer the live domain so the email link works even if the user opened
        // an old vercel.app alias. Supabase still falls back to Site URL when the
        // redirect isn't allow-listed — AuthHashHandler then routes type=recovery.
        const resetOrigin =
          origin.includes("agsswap.com") || origin.includes("localhost")
            ? origin
            : "https://agsswap.com";
        const { error: err } = await supabase.auth.resetPasswordForEmail(currentEmail, {
          redirectTo: `${resetOrigin}/auth/callback?next=/auth/reset`,
        });
        if (err) throw err;
        setDone({ kind: "reset", email: currentEmail });
        return;
      }

      if (mode === "signup") {
        if (!agreed && formData.get("agreeTerms") !== "on") {
          setError("Please confirm you're 18 or older and agree to the Terms and Privacy Policy.");
          return;
        }
        const name = currentDisplayName.trim() || currentEmail.split("@")[0];
        const { data, error: err } = await supabase.auth.signUp({
          email: currentEmail,
          password: currentPassword,
          options: {
            data: {
              display_name: name,
              terms_accepted: true,
              terms_version: TERMS_VERSION,
              privacy_version: PRIVACY_VERSION,
              terms_accepted_at: new Date().toISOString(),
            },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeAuthNext(searchParams.get("next"), "/account"))}`,
          },
        });
        if (err) throw err;

        // Supabase answers a sign-up for an already-registered email with a
        // placeholder user that has no identities (and sends no email).
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setDone({ kind: "exists", email: currentEmail });
          return;
        }

        if (data.user) {
          await ensureProfile(supabase, data.user.id, data.user.email, name);
        }

        if (data.session) {
          router.push(safeAuthNext(searchParams.get("next"), "/account"));
          router.refresh();
          return;
        }

        setDone({ kind: "confirm", email: currentEmail });
        return;
      }

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (err) {
        if (
          (err as { code?: string }).code === "email_not_confirmed" ||
          err.message.toLowerCase().includes("email not confirmed")
        ) {
          setShowResend(true);
        }
        throw err;
      }
      if (data.user) {
        await ensureProfile(
          supabase,
          data.user.id,
          data.user.email,
          (data.user.user_metadata?.display_name as string) ||
            currentEmail.split("@")[0]
        );
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="panel auth-panel" role="status" aria-live="polite">
        {done.kind === "confirm" ? (
          <>
            <h2 style={{ marginTop: 0 }}>Check your email</h2>
            <div className="ok">
              We sent a confirmation link to <strong>{done.email}</strong>. Open it
              on this device to finish creating your account.
            </div>
            <p className="help">
              Not there after a few minutes? Check spam/promotions, or resend it.
            </p>
            {notice ? <div className="ok">{notice}</div> : null}
            {error ? <div className="err">{error}</div> : null}
            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => resendConfirmation(done.email)}
              >
                {loading ? "Sending…" : "Resend email"}
              </button>
              <button type="button" className="ghost" onClick={() => switchMode("signin")}>
                Back to sign in
              </button>
            </div>
          </>
        ) : done.kind === "exists" ? (
          <>
            <h2 style={{ marginTop: 0 }}>You already have an account</h2>
            <div className="warn">
              <strong>{done.email}</strong> is already registered, so no new account
              was created. Sign in with your existing password, or reset it.
            </div>
            <div className="actions">
              <button type="button" className="primary" onClick={() => switchMode("signin")}>
                Sign in
              </button>
              <button type="button" className="ghost" onClick={() => switchMode("reset")}>
                Reset password
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Check your email</h2>
            <div className="ok">
              If <strong>{done.email}</strong> has an AgsSwap account, we sent it a
              link to set a new password. Open it on this device.
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => switchMode("signin")}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password";
  const submitLabel = loading
    ? mode === "signin"
      ? "Signing in…"
      : mode === "signup"
        ? "Creating account…"
        : "Sending link…"
    : mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create account"
        : "Email me a reset link";

  return (
    <div className="panel auth-panel">
      {mode !== "reset" ? (
        <div className="auth-tabs" role="tablist" aria-label="Sign in or create account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "active" : undefined}
            disabled={loading}
            onClick={() => switchMode("signin")}
          >
            I have an account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : undefined}
            disabled={loading}
            onClick={() => switchMode("signup")}
          >
            I&apos;m new here
          </button>
        </div>
      ) : null}
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="help" style={{ marginBottom: 16 }}>
        {mode === "reset"
          ? "Enter your email and we'll send a link to set a new password."
          : mode === "signup"
            ? "Farm & ranch marketplace — Texas-first, open across the U.S. We'll email you a link to confirm your address."
            : "Farm & ranch marketplace — Texas-first, open across the U.S. Sign in with your email and password."}
      </p>
      {!configured ? <div className="err">{MISSING_SUPABASE_ENV_MESSAGE}</div> : null}
      {error ? (
        <div className="err" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? <div className="ok">{notice}</div> : null}
      {showResend && email ? (
        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="ghost"
            disabled={loading}
            onClick={() => resendConfirmation(email)}
          >
            Resend confirmation email
          </button>
        </div>
      ) : null}
      <form onSubmit={onSubmit}>
        {mode === "signup" ? (
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input
              id="name"
              name="displayName"
              value={displayName}
              onInput={(e) => setDisplayName(e.currentTarget.value)}
              placeholder="Alex"
              autoComplete="nickname"
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
            autoComplete="email"
          />
        </div>
        {mode !== "reset" ? (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "signup" ? <p className="help">At least 6 characters.</p> : null}
          </div>
        ) : null}
        {mode === "signup" ? (
          <label className="terms-check" htmlFor="agreeTerms">
            <input
              id="agreeTerms"
              name="agreeTerms"
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
            />
            <span>
              I&apos;m 18 or older and agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener">Terms</a> and{" "}
              <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
            </span>
          </label>
        ) : null}
        <button
          className="primary auth-submit"
          type="submit"
          disabled={loading || !configured || (mode === "signup" && !agreed)}
          aria-busy={loading}
        >
          {submitLabel}
        </button>
      </form>
      <div className="auth-links">
        {mode === "signin" ? (
          <button
            type="button"
            className="link-btn"
            style={{ fontWeight: 700, textDecoration: "underline", fontSize: 15 }}
            disabled={loading}
            onClick={() => switchMode("reset")}
          >
            Forgot password?
          </button>
        ) : mode === "reset" ? (
          <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
            ← Back to sign in
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="wrap">
      <AuthBrand>
        <Suspense
          fallback={
            <div className="panel auth-panel">
              <p className="muted">Loading…</p>
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </AuthBrand>
    </div>
  );
}
