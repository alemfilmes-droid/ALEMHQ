import Link from "next/link";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { Handshake } from "lucide-react";
import { DealStageBadge } from "@/features/crm/components/deal-stage-badge";
import { PROPOSAL_STATUS_LABELS } from "@/features/crm/labels";
import { StageProbabilitiesForm } from "@/features/finance/components/stage-probabilities-form";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { formatCents } from "@/features/finance/money";
import { getBudgetsInNegotiation, getDealsInNegotiation, getStageProbabilities, summarizeNegotiation } from "@/features/finance/queries";
import { sumCents } from "@/features/finance/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import { formatDate } from "@/lib/format";

/**
 * Projeção comercial: todo negócio com proposta registrada que ainda não foi ganho nem perdido. É
 * previsão (valor × probabilidade da etapa) — nunca entra em recebimentos reais.
 */
export async function NegotiationTab({ canEditProbabilities }: { canEditProbabilities: boolean }) {
  const [items, probabilities, budgets] = await Promise.all([
    getDealsInNegotiation(),
    canEditProbabilities ? getStageProbabilities() : Promise.resolve([]),
    getBudgetsInNegotiation(),
  ]);
  const totals = summarizeNegotiation(items);
  const budgetsTotal = sumCents(budgets.map((item) => item.total));

  return (
    <div className="space-y-6">
      <div className="card-grid">
        {[
          { title: "Negócios com proposta", value: totals.count, format: "number" as const },
          { title: "Valor em negociação", value: sumCents([totals.total, budgetsTotal]), format: "cents" as const },
          { title: "Previsão ponderada", value: totals.weighted, format: "cents" as const },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricValue value={item.value} format={item.format} />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">Projeção comercial — não é recebimento. A previsão ponderada é o valor da proposta × a probabilidade da etapa.</p>

      {items.length === 0 ? (
        <EmptyState icon={Handshake} title="Nenhuma proposta em aberto." hint="Quando o comercial registrar uma proposta, ela aparece aqui." />
      ) : (
        <TableShell minWidth="min-w-[980px]">
          <thead>
            <tr>
              <Th>Cliente / negócio</Th>
              <Th>Etapa</Th>
              <Th>SDR</Th>
              <Th align="right">Proposta</Th>
              <Th>Status</Th>
              <Th>Previsão de fechamento</Th>
              <Th align="right">Prob.</Th>
              <Th align="right">Ponderado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.dealId}>
                <td className="px-4 py-3">
                  <Link href={`/clientes/${item.companyId}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                    <ClientAvatar name={item.companyName} logoUrl={item.companyLogoUrl} size="sm" />
                    {item.companyName}
                  </Link>
                  <span className="block text-[13px] text-muted-foreground">
                    {item.code} · {item.title}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DealStageBadge stage={item.stage} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.ownerName}</td>
                <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatCents(item.proposalAmount)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {PROPOSAL_STATUS_LABELS[item.proposalStatus]}
                  <span className="block text-[12px]">enviada em {formatDate(item.proposalSentAt)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{item.expectedCloseDate ? formatDate(item.expectedCloseDate) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{Math.round(item.probability * 100)}%</td>
                <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatCents(item.weightedAmount)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {budgets.length > 0 ? (
        <section className="space-y-3">
          <h2 className="section-title">Orçamentos enviados (fora do CRM)</h2>
          <TableShell minWidth="min-w-[720px]">
            <thead>
              <tr>
                <Th>Cliente / orçamento</Th>
                <Th>Situação</Th>
                <Th>Enviado em</Th>
                <Th>Validade</Th>
                <Th align="right">Valor</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {budgets.map((item) => (
                <tr key={item.budgetId}>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{item.clientName}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {item.label} · {item.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.status === "em_ajuste" ? "Em ajuste" : "Aguardando resposta"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{item.sentAt ? formatDate(item.sentAt) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(item.validUntil)}</td>
                  <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatCents(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </section>
      ) : null}

      {canEditProbabilities ? <StageProbabilitiesForm probabilities={probabilities} /> : null}
    </div>
  );
}
