"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Home used to be a server redirect to /browse. That broke password-reset emails:
 * Supabase Site URL is the bare origin, so recovery links land on
 * `/#access_token=…&type=recovery`. A server 307 to /browse drops the #fragment.
 * When a hash is present, stay put for AuthHashHandler; otherwise go to Browse.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash.includes("access_token=")) {
      const isRecovery = hash.includes("type=recovery");
      const t = window.setTimeout(() => {
        if (window.location.pathname !== "/") return;
        router.replace(isRecovery ? "/auth/reset" : "/account");
      }, 3200);
      return () => window.clearTimeout(t);
    }
    router.replace("/browse");
  }, [router]);

  return (
    <div className="wrap">
      <p className="muted">Loading…</p>
    </div>
  );
}
