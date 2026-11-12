import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { prohibited } from "@/content/legal/generated";

export const metadata: Metadata = { title: "Prohibited Items · AgsSwap" };

export default function Page() {
  return <LegalPage title="Prohibited Items" markdown={prohibited} />;
}
