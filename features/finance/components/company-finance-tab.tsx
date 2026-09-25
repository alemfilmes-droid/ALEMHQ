import { Plus } from "lucide-react";
import { PayableDialog } from "@/features/finance/components/payable-dialog";
import { PayablesTable } from "@/features/finance/components/payables-table";
import { ReceivableDialog } from "@/features/finance/components/receivable-dialog";
import { ReceivablesTable } from "@/features/finance/components/receivables-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import { todayISO } from "@/features/finance/period";
import { getCompanyFinance, getFinanceOptions } from "@/features/finance/queries";

/** Só é renderizado para quem tem a capability "finance"; as queries a exigem de novo. */
export async function CompanyFinanceTab({ companyId }: { companyId: string }) {
  const [finance, options] = await Promise.all([getCompanyFinance(companyId), getFinanceOptions()]);
  const today = todayISO();

  const stats = [
    { label: "Total faturado", value: finance.billed, note: "Todos os recebimentos não cancelados" },
    { label: "Recebido", value: finance.received },
    { label: "Em aberto", value: finance.open },
    { label: "Custos", value: finance.costs, note: "Vinculados a este cliente" },
  ];

  return (
    <div className="space-y-8">
      <section aria-label="Resumo financeiro" className="card-grid">
        {stats.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricValue value={item.value} format="cents" />
              {item.note ? <p className="mt-1 text-xs text-subtle">{item.note}</p> : null}
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="company-receivables-title" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="company-receivables-title" className="section-title">
            Recebimentos
          </h2>
          <ReceivableDialog
            mode="create"
            options={options}
            today={today}
            defaults={{ companyId }}
            trigger={
              <Button variant="secondary" size="sm">
                <Plus aria-hidden />
                Novo recebimento
              </Button>
            }
          />
        </div>
        <ReceivablesTable rows={finance.receivables} options={options} today={today} compact showProject csvName="recebimentos-da-empresa.csv" />
      </section>

      <section aria-labelledby="company-payables-title" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="company-payables-title" className="section-title">
            Custos
          </h2>
          <PayableDialog
            mode="create"
            options={options}
            today={today}
            defaultCompanyId={companyId}
            trigger={
              <Button variant="secondary" size="sm">
                <Plus aria-hidden />
                Novo custo
              </Button>
            }
          />
        </div>
        <PayablesTable rows={finance.payables} options={options} today={today} csvName="custos-do-cliente.csv" />
      </section>
    </div>
  );
}
