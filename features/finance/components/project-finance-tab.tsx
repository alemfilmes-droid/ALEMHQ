import { Plus } from "lucide-react";
import { FinancialsForm } from "@/components/projects/financials-form";
import { GenerateInstallmentsDialog } from "@/features/finance/components/generate-installments-dialog";
import { PayableDialog } from "@/features/finance/components/payable-dialog";
import { PayablesTable } from "@/features/finance/components/payables-table";
import { ReceivableDialog } from "@/features/finance/components/receivable-dialog";
import { ReceivablesTable } from "@/features/finance/components/receivables-table";
import { Button } from "@/components/ui/button";
import { MetricGrid, MetricValue } from "@/components/ui/metric-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToInput, formatCents, toCents } from "@/features/finance/money";
import { todayISO } from "@/features/finance/period";
import { getFinanceOptions, getProjectFinance } from "@/features/finance/queries";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, toneColor } from "@/lib/status";
import { getCompanySettings } from "@/features/settings/queries";
import { formatPercent } from "@/lib/margin";
import { createClient } from "@/lib/supabase/server";

interface ProjectFinanceTabProps {
  projectId: string;
  companyId: string | null;
  isInternal: boolean;
}

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border">
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

/** Só é renderizado para quem tem a capability "finance"; as queries a exigem de novo. */
export async function ProjectFinanceTab({ projectId, companyId, isInternal }: ProjectFinanceTabProps) {
  const supabase = await createClient();
  const [{ receivables, payables, profitability }, options, financialsResult, settings] = await Promise.all([
    getProjectFinance(projectId),
    getFinanceOptions(),
    supabase.from("project_financials").select("*").eq("project_id", projectId).maybeSingle(),
    getCompanySettings(),
  ]);
  const today = todayISO();
  const contractCents = financialsResult.data?.contract_value == null ? null : toCents(financialsResult.data.contract_value);
  const hasOpenReceivables = receivables.some((item) => item.status !== "cancelado");

  return (
    <div className="space-y-6">
      {isInternal ? null : (
        <Section title="Contrato">
          <FinancialsForm
            projectId={projectId}
            defaultValues={{
              contractValue: contractCents != null ? centsToInput(contractCents) : "",
              paymentTerms: financialsResult.data?.payment_terms ?? "",
            }}
          />
        </Section>
      )}

      {isInternal || !companyId ? null : (
        <Section
          title="Parcelas"
          actions={
            <div className="flex flex-wrap gap-2">
              <GenerateInstallmentsDialog
                projectId={projectId}
                contractCents={contractCents}
                hasOpenReceivables={hasOpenReceivables}
                today={today}
              />
              <ReceivableDialog
                mode="create"
                options={options}
                today={today}
                defaults={{ companyId, projectId }}
                trigger={
                  <Button variant="secondary" size="sm">
                    <Plus aria-hidden />
                    Novo recebimento
                  </Button>
                }
              />
            </div>
          }
        >
          <ReceivablesTable rows={receivables} options={options} today={today} compact csvName="parcelas-do-projeto.csv" />
        </Section>
      )}

      <Section
        title="Custos do projeto"
        actions={
          <PayableDialog
            mode="create"
            options={options}
            today={today}
            lockedProjectId={projectId}
            trigger={
              <Button variant="secondary" size="sm">
                <Plus aria-hidden />
                Adicionar custo
              </Button>
            }
          />
        }
      >
        <PayablesTable rows={payables} options={options} today={today} compact csvName="custos-do-projeto.csv" />
      </Section>

      <Section title="Margem">
        {profitability?.marginStatus && profitability.marginPct != null ? (
          <MetricGrid min="10rem">
            <div className="min-w-0">
              <p className="eyebrow">Margem prevista</p>
              <MetricValue className="mt-1" value={profitability.plannedMargin} format="cents" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Percentual</p>
              <MetricValue className="mt-1" value={profitability.marginPct} format="percent" sensitive tone={MARGIN_STATUS_TONE[profitability.marginStatus]} />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Situação</p>
              <p className="mt-1 text-sm font-bold" style={{ color: toneColor(MARGIN_STATUS_TONE[profitability.marginStatus]) }}>
                {MARGIN_STATUS_LABELS[profitability.marginStatus]}
              </p>
              <p className="mt-0.5 text-xs text-subtle">Meta: margem líquida de {formatPercent(settings.margin.healthy)}</p>
            </div>
          </MetricGrid>
        ) : (
          <p className="text-sm text-muted-foreground">Defina o valor do contrato para calcular a margem.</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          {[
            { label: "Contrato", value: contractCents != null ? formatCents(contractCents) : "—" },
            { label: "Recebido", value: formatCents(profitability?.totalReceived ?? 0) },
            { label: "A receber", value: formatCents(profitability?.receivablePending ?? 0) },
            { label: "Custos", value: formatCents(profitability?.payablesTotal ?? 0) },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-bold" data-sensitive>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
