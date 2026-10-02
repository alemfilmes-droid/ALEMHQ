import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BudgetsHome } from "@/features/budgets/components/budgets-home";
import { getProposalProfile, listBudgets, listCatalog } from "@/features/budgets/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orçamentos" };

type SearchParams = Promise<{ aba?: string }>;

export default async function BudgetsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (!hasCapability(profile, "budgets")) redirect("/inicio");
  const { aba } = await searchParams;

  const supabase = await createClient();
  const [budgets, catalog, proposalProfile, companies] = await Promise.all([
    listBudgets(),
    listCatalog(),
    getProposalProfile(),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  return (
    <>
      <PageHeader panel="/orcamentos" title="Orçamentos." description="Orçamentos, notas de orçamento e apresentações comerciais. Só você tem acesso." />
      <BudgetsHome
        budgets={budgets}
        catalog={catalog}
        profile={proposalProfile}
        companies={companies.data ?? []}
        initialTab={aba === "catalogo" || aba === "perfil" ? aba : "orcamentos"}
      />
    </>
  );
}
