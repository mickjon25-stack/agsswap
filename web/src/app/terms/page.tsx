import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { terms } from "@/content/legal/generated";

export const metadata: Metadata = { title: "Terms of Service · AgsSwap" };

export default function Page() {
  return <LegalPage title="Terms of Service" markdown={terms} />;
}
