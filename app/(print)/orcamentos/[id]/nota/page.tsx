import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BudgetNote } from "@/features/budgets/documents/budget-note";
import { PrintToolbar } from "@/features/budgets/documents/print-toolbar";
import { getBudget, getProposalProfile } from "@/features/budgets/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const budget = await getBudget((await params).id);
  return { title: budget ? `Orçamento ${String(budget.number).padStart(4, "0")} · ${budget.clientName}` : "Orçamento" };
}

export default async function BudgetNotePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (!hasCapability(profile, "budgets")) redirect("/inicio");
  const { id } = await params;
  const [budget, proposalProfile] = await Promise.all([getBudget(id), getProposalProfile()]);
  if (!budget) notFound();

  return (
    <div className="min-h-dvh bg-[#1a1a1a] print:bg-white">
      <style>{`@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; } .budget-note { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <PrintToolbar title={`Nota de orçamento · ${budget.clientName}`} hint="Na janela de impressão, escolha “Salvar como PDF” e ative “Gráficos de fundo”." />
      <BudgetNote budget={budget} profile={proposalProfile} />
    </div>
  );
}
