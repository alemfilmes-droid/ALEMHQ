import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";

export const metadata: Metadata = { title: "Avisos" };

export default function Page() {
  return <UnderConstruction title="Avisos" panel="/avisos" description="Os comunicados internos chegam em uma fase futura." />;
}
