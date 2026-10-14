import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import { NegotiationList, NegotiationTotals } from "@/features/finance/components/negotiation-sheet";
import { StageProbabilitiesForm } from "@/features/finance/components/stage-probabilities-form";
import { getNegotiationPipeline, getStageProbabilities } from "@/features/finance/queries";

/**
 * Projeção comercial — mesma regra e mesmos números do card "Em negociação" do Dashboard
 * (lib/finance/negotiation.ts). É previsão (valor × probabilidade da etapa): nunca entra em recebimentos reais.
 */
export async function NegotiationTab({ canEditProbabilities }: { canEditProbabilities: boolean }) {
  const [summary, probabilities] = await Promise.all([getNegotiationPipeline(), canEditProbabilities ? getStageProbabilities() : Promise.resolve([])]);

  return (
    <div className="space-y-6">
      <div className="card-grid">
        {[
          { title: "Itens em negociação", value: summary.count, format: "number" as const },
          { title: "Valor em negociação", value: summary.totalCents, format: "cents" as const },
          { title: "Previsão ponderada", value: summary.weightedCents, format: "cents" as const },
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
      <p className="text-[13px] text-muted-foreground">
        Projeção comercial — não é recebimento. Contam orçamentos enviados, em análise ou em ajuste e negócios do CRM com proposta; negócio com orçamento ligado conta uma vez
        só (pelo orçamento). A previsão ponderada é o valor × a probabilidade da etapa no CRM.
      </p>

      <NegotiationTotals summary={summary} />
      <Card>
        <CardContent className="pt-2">
          <NegotiationList entries={summary.entries} />
        </CardContent>
      </Card>

      {canEditProbabilities ? <StageProbabilitiesForm probabilities={probabilities} /> : null}
    </div>
  );
}
