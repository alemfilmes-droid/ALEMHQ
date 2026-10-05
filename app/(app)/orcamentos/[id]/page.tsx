import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BudgetEditor } from "@/features/budgets/components/budget-editor";
import { getBudget, listCatalog } from "@/features/budgets/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orçamento" };

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (!hasCapability(profile, "budgets")) redirect("/inicio");
  const { id } = await params;

  const supabase = await createClient();
  const [budget, catalog, companies] = await Promise.all([getBudget(id), listCatalog(), supabase.from("companies").select("id, name, logo_url").order("name")]);
  if (!budget) notFound();

  return (
    <>
      <PageHeader panel="/orcamentos" eyebrow={`Orçamento nº ${String(budget.number).padStart(4, "0")}${budget.version > 1 ? ` · v${budget.version}` : ""}${budget.archivedAt ? " · Arquivado" : ""}`} title={budget.title} description={budget.clientName} />
      <BudgetEditor budget={budget} catalog={catalog} companies={companies.data ?? []} canConfirmContract={hasCapability(profile, "finance")} />
    </>
  );
}
