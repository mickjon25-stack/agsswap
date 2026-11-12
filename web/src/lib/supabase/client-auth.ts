import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

const DEFAULT_TIMEOUT_MS = 3500;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Reliable client-side auth probe for page gates.
 * Prefers a fast local `getSession()` (no network), then optionally soft-validates
 * with `getUser()`. Always settles within ~timeoutMs so UI never hangs on
 * "Checking…" when the session cookie already exists.
 *
 * Returns null when unsigned or when the local session check fails/times out
 * (callers should redirect to /auth). When a session exists but getUser hangs,
 * returns the local session user so gated forms can render.
 */
export async function resolveClientUser(options?: {
  timeoutMs?: number;
}): Promise<User | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const supabase = createClient();

  let sessionUser: User | null = null;
  try {
    const {
      data: { session },
    } = await withTimeout(supabase.auth.getSession(), timeoutMs, "getSession");
    sessionUser = session?.user ?? null;
  } catch {
    return null;
  }

  if (!sessionUser) return null;

  try {
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), timeoutMs, "getUser");
    // Network validation says signed-out — trust that over a stale cookie.
    if (!user) return null;
    return user;
  } catch {
    // getUser hung/errored — local session is enough to show the gated form;
    // submit handlers still re-check auth before writes.
    return sessionUser;
  }
}
