"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";

/**
 * Auth email links land with either:
 *   - PKCE `?code=` (handled by /auth/callback), or
 *   - Implicit `#access_token=…&type=…` on Site URL (often `/`).
 *
 * The browser client may auto-consume the hash before we read `type=`, so we
 * also listen for the PASSWORD_RECOVERY event — that is what must always send
 * the user to /auth/reset (otherwise they just appear signed in on Browse/Account).
 */
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/reset");
        router.refresh();
      }
    });

    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) {
      return () => sub.subscription.unsubscribe();
    }
    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const hashType = params.get("type");
    if (!access_token || !refresh_token) {
      return () => sub.subscription.unsubscribe();
    }

    (async () => {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", url.pathname + url.search);
      if (error) {
        router.replace(`/auth?error=${encodeURIComponent(error.message)}`);
        return;
      }
      if (hashType === "recovery") {
        router.replace("/auth/reset");
        router.refresh();
        return;
      }
      const nextRaw = url.searchParams.get("next") ?? "";
      const next =
        nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\")
          ? nextRaw
          : "/account";
      if (url.pathname === "/auth" || url.pathname === "/auth/callback" || url.pathname === "/") {
        router.replace(next);
      } else {
        router.replace(url.pathname + url.search);
      }
      router.refresh();
    })();

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return null;
}
