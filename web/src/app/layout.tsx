import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { getMyProfile } from "@/lib/supabase/my-profile";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { TabBar } from "@/components/TabBar";
import { ConfigBanner } from "@/components/ConfigBanner";
import { AvatarNudgeBanner } from "@/components/AvatarNudgeBanner";
import { AuthHashHandler } from "@/components/AuthHashHandler";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import type { Profile } from "@/lib/types";
import { CONTACT_EMAIL } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ui = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-ui-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgsSwap — farm & ranch swap",
  description:
    "Texas-first marketplace for farm & ranch gear, hay, fencing, implements and livestock. Swap first; sell when it helps.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#4f7a2a",
};

async function getProfile(): Promise<Profile | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await getMyProfile(supabase);
    return data;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getProfile();

  return (
    <html lang="en" className={ui.variable}>
      <body>
        <div className="app-shell">
          <Nav profile={profile} />
          <ConfigBanner />
          <AvatarNudgeBanner missingAvatar={!!profile && !profile.avatar_url} />
          <AuthHashHandler />
          <main className="app-main">{children}</main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-64.png" alt="" width={24} height={24} />
              <span>
                <strong>AgsSwap™</strong> · Farm &amp; ranch · swap first · a RenoSwap company
              </span>
            </div>
            <nav className="site-footer-links" aria-label="Legal">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/prohibited">Prohibited items</a>
              <a href="/safety">Safety tips</a>
              <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
            </nav>
            <p className="site-footer-legal">© 2026 RenoSwap LLC · AgsSwap, a RenoSwap company · Moulton, Texas</p>
          </footer>
        </div>
        <TabBar signedIn={!!profile} />
      </body>
    </html>
  );
}
