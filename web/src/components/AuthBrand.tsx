import type { ReactNode } from "react";

/** Logo + short "why join" intro used on sign-in, sign-up, and logged-out Post. */
export function AuthBrand({
  children,
  lead = "Swap, sell, or give away farm & ranch gear with folks nearby.",
}: {
  children: ReactNode;
  lead?: string;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="auth-brand-logo"
          src="/logo-64.png"
          alt=""
          width={56}
          height={56}
        />
        <p className="auth-brand-name">
          AgsSwap<sup>™</sup>
        </p>
        <p className="auth-brand-lead">{lead}</p>
        <ul className="auth-benefits">
          <li>Free to post</li>
          <li>Every listing reviewed</li>
          <li>Sell or swap locally</li>
        </ul>
      </div>
      {children}
    </div>
  );
}
