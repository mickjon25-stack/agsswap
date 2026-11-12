"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/browse", label: "Browse", d: "M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" },
  { href: "/post", label: "Post", d: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" },
  { href: "/inbox", label: "Inbox", d: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v.3l7 4.6 7-4.6V7H5Zm14 2.7-7 4.6-7-4.6V17h14V9.7Z" },
  { href: "/account", label: "Profile", d: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 8c4 0 7 2 7 4.5V20H5v-1.5C5 16 8 14 12 14Zm0 2c-2.6 0-4.5 1.1-4.9 2h9.8c-.4-.9-2.3-2-4.9-2Z" },
];

/** Phone-only bottom tab bar. Visual shortcut to existing routes. */
export function TabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || "";
  return (
    <nav className="tabbar" aria-label="Tabs">
      {TABS.map((t) => {
        const href = !signedIn && t.href === "/account" ? "/auth" : t.href;
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={href} className={`tab${active ? " active" : ""}${t.href === "/post" ? " tab-post" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="tab-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={t.d} fill="currentColor" /></svg>
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
