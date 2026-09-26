import { AttentionList } from "@/features/finance/components/attention-list";
import { CashFlowChart } from "@/features/finance/components/charts/cash-flow-chart";
import { CategoryCostsChart } from "@/features/finance/components/charts/category-costs-chart";
import { IncomeExpenseChart } from "@/features/finance/components/charts/income-expense-chart";
import { NetResultChart } from "@/features/finance/components/charts/net-result-chart";
import { ProjectMarginChart } from "@/features/finance/components/charts/project-margin-chart";
import { DashboardKpiRow } from "@/features/finance/components/dashboard-kpis";
import type { Period } from "@/features/finance/period";
import {
  getAttentionItems,
  getCashFlowProjection,
  getCategoryCosts,
  getDashboardKpis,
  getDealsInNegotiation,
  summarizeNegotiation,
  getMonthlySummary,
  listProfitability,
} from "@/features/finance/queries";
import { getCompanySettings } from "@/features/settings/queries";

export async function DashboardTab({ period }: { period: Period }) {
  const [kpis, monthly, categories, margins, attention, cashFlow, negotiation, settings] = await Promise.all([
    getDashboardKpis(period),
    getMonthlySummary(),
    getCategoryCosts(period),
    listProfitability(),
    getAttentionItems(),
    getCashFlowProjection(),
    getDealsInNegotiation(),
    getCompanySettings(),
  ]);

  // finance_monthly_summary traz 18 meses (11 atrás até 6 à frente), em ordem crescente;
  // os 12 primeiros são os últimos 12 meses (inclui o atual).
  const trailingTwelve = monthly.slice(0, 12);

  return (
    <div className="space-y-6">
      <DashboardKpiRow kpis={kpis} period={period} negotiation={summarizeNegotiation(negotiation)} />

      <div className="grid gap-4 xl:grid-cols-2">
        <IncomeExpenseChart data={trailingTwelve} />
        <NetResultChart data={monthly} />
        <CategoryCostsChart data={categories} />
        <ProjectMarginChart data={margins} target={settings.margin.healthy} />
      </div>

      <CashFlowChart data={cashFlow} />

      <section aria-labelledby="attention-now-title" className="space-y-3">
        <h2 id="attention-now-title" className="section-title">
          Atenção agora
        </h2>
        <AttentionList items={attention} />
      </section>
    </div>
  );
}
