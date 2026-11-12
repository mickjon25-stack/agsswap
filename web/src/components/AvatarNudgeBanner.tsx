"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "agsswap.dismiss.avatar-nudge";

function pathShowsNudge(pathname: string) {
  return (
    pathname === "/browse" ||
    pathname.startsWith("/browse/") ||
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/")
  );
}

/**
 * Soft, dismissible reminder to add a profile photo (trust for meetups).
 * Never blocks posting — only appears when signed in and avatar is missing.
 */
export function AvatarNudgeBanner({ missingAvatar }: { missingAvatar: boolean }) {
  const pathname = usePathname() || "";
  // Start hidden to avoid a dismiss-flash before localStorage is read.
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, []);

  if (!missingAvatar || !ready || dismissed || !pathShowsNudge(pathname)) return null;

  const onAccount = pathname === "/account" || pathname.startsWith("/account/");
  const href = onAccount ? "#avatar" : "/account#avatar";

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="wrap" style={{ paddingBottom: 0 }}>
      <div className="avatar-nudge" role="status">
        <div className="avatar-nudge-text">
          <strong>Add a profile photo?</strong>
          <span>
            A face helps neighbors trust you at meetups. Optional — never required to post.
          </span>
          <Link href={href} className="avatar-nudge-link">
            {onAccount ? "Add photo below" : "Add photo on Account"}
          </Link>
        </div>
        <button type="button" className="avatar-nudge-dismiss" onClick={dismiss} aria-label="Dismiss">
          Not now
        </button>
      </div>
    </div>
  );
}
