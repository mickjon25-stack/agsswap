"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  browse: "M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
  post: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z",
  listings: "M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h10v2H4v-2Z",
  inbox: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v.3l7 4.6 7-4.6V7H5Zm14 2.7-7 4.6-7-4.6V17h14V9.7Z",
  billing: "M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm2 1v2h14V7H5Zm0 5v5h14v-5H5Zm2 2h4v1.5H7V14Z",
  admin: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 2.2 6 2.2V11c0 3.9-2.5 7.4-6 8.9-3.5-1.5-6-5-6-8.9V6.4l6-2.2Z",
  account: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 8c4 0 7 2 7 4.5V20H5v-1.5C5 16 8 14 12 14Zm0 2c-2.6 0-4.5 1.1-4.9 2h9.8c-.4-.9-2.3-2-4.9-2Z",
  signin: "M10 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-9v-2h8V6h-8V4Zm1.6 3.6L16 12l-4.4 4.4-1.4-1.4 2-2H4v-2h8.2l-2-2 1.4-1.4Z",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={ICONS[name]} fill="currentColor" />
    </svg>
  );
}

export function Nav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu after navigating, on Escape, or on outside tap.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const items: NavItem[] = [
    { href: "/browse", label: "Browse", icon: "browse" },
    { href: "/post", label: "Post", icon: "post" },
  ];
  if (profile) {
    items.push(
      { href: "/my-listings", label: "My listings", icon: "listings" },
      { href: "/inbox", label: "Inbox", icon: "inbox" },
      { href: "/billing", label: "Billing", icon: "billing" }
    );
  }
  if (profile?.is_admin) items.push({ href: "/admin", label: "Admin", icon: "admin" });

  const cls = (href: string, extra = "") =>
    [extra, isActive(href) ? "active" : ""].filter(Boolean).join(" ") || undefined;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/browse" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="logo-img"
            src="/logo-64.png"
            alt="AgsSwap — farm & ranch · swap first"
            width={36}
            height={36}
          />
          <div className="brand-text">
            <h1>AgsSwap<sup style={{ fontSize: "0.45em", marginLeft: "1px" }}>™</sup></h1>
            <span>Farm &amp; ranch · swap first</span>
          </div>
        </Link>

        {/* Desktop / tablet: inline links */}
        <nav className="nav nav-desktop" aria-label="Main">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cls(it.href, it.href === "/post" ? "nav-post" : "")}
              aria-current={isActive(it.href) ? "page" : undefined}
            >
              {it.label}
            </Link>
          ))}
          {profile ? (
            <Link
              href="/account"
              className={cls("/account", "nav-account")}
              aria-label="Account"
              aria-current={isActive("/account") ? "page" : undefined}
            >
              <Avatar url={profile.avatar_url} name={profile.display_name} size="sm" />
              <span>Account</span>
            </Link>
          ) : (
            <Link href="/auth" className={cls("/auth", "nav-signin")}>
              Sign in
            </Link>
          )}
        </nav>

        {/* Phone: compact Post button + menu sheet */}
        <div className="nav-mobile" ref={menuRef}>
          <Link href="/post" className="nav-mobile-post" aria-label="Post">
            <Icon name="post" />
            <span>Post</span>
          </Link>
          <button
            type="button"
            className={`menu-toggle${open ? " open" : ""}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {profile ? (
              <Avatar url={profile.avatar_url} name={profile.display_name} size="sm" />
            ) : null}
            <span className="burger" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <div id="mobile-menu" className={`menu-sheet${open ? " open" : ""}`} hidden={!open}>
            <nav aria-label="Main">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cls(it.href)}
                  aria-current={isActive(it.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon name={it.icon} />
                  {it.label}
                </Link>
              ))}
              <div className="menu-sep" />
              {profile ? (
                <Link
                  href="/account"
                  className={cls("/account", "menu-account")}
                  aria-label="Account"
                  aria-current={isActive("/account") ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Avatar url={profile.avatar_url} name={profile.display_name} size="sm" />
                  <span>
                    Account
                    <small>{profile.display_name}</small>
                  </span>
                </Link>
              ) : (
                <Link href="/auth" className={cls("/auth")} onClick={() => setOpen(false)}>
                  <Icon name="signin" />
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
