import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { safety } from "@/content/legal/generated";

export const metadata: Metadata = { title: "Safety tips for meetups and pickups · AgsSwap" };

export default function Page() {
  return <LegalPage title="Safety tips for meetups and pickups" markdown={safety} />;
}
