import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProposalDeck } from "@/features/budgets/documents/proposal-deck";
import { PrintToolbar } from "@/features/budgets/documents/print-toolbar";
import { getBudget, getProposalProfile } from "@/features/budgets/queries";
import { PROPOSAL_TEMPLATE_INFO } from "@/features/budgets/types";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const budget = await getBudget((await params).id);
  return { title: budget ? `Proposta · ${budget.clientName} · ${budget.title}` : "Proposta" };
}

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (!hasCapability(profile, "budgets")) redirect("/inicio");
  const { id } = await params;
  const [budget, proposalProfile] = await Promise.all([getBudget(id), getProposalProfile()]);
  if (!budget) notFound();

  return (
    <div className="min-h-dvh bg-[#1a1a1a] print:bg-black">
      <style>{`@page { size: 1280px 720px; margin: 0; }
        @media print {
          html, body { background: #0A0A0A !important; }
          .deck-slide { width: 1280px !important; max-width: none !important; height: 720px; margin: 0 !important; break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }`}</style>
      <PrintToolbar
        title={`Proposta (${PROPOSAL_TEMPLATE_INFO[budget.presentation.template].name}) · ${budget.clientName}`}
        hint="Na impressão: “Salvar como PDF”, margens “Nenhuma” e “Gráficos de fundo” ativado."
      />
      <div className="px-4 py-8 print:p-0">
        <ProposalDeck budget={budget} profile={proposalProfile} content={budget.presentation} />
      </div>
    </div>
  );
}
