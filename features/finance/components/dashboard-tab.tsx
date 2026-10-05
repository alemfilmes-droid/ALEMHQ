import { AttentionList } from "@/features/finance/components/attention-list";
import { CashFlowChart } from "@/features/finance/components/charts/cash-flow-chart";
import { CategoryCostsChart } from "@/features/finance/components/charts/category-costs-chart";
import { IncomeExpenseChart } from "@/features/finance/components/charts/income-expense-chart";
import { NetResultChart } from "@/features/finance/components/charts/net-result-chart";
import { ProjectMarginChart } from "@/features/finance/components/charts/project-margin-chart";
import { DashboardKpiRow } from "@/features/finance/components/dashboard-kpis";
import { LatePaymentsReport } from "@/features/finance/components/late-payments-report";
import { MarginBelowTargetReport } from "@/features/finance/components/margin-below-target";
import type { Period } from "@/features/finance/period";
import {
  getAttentionItems,
  getCashFlowProjection,
  getCategoryCosts,
  getDashboardKpis,
  getDealsInNegotiation,
  summarizeNegotiation,
  getLatePayments,
  getMarginBelowTarget,
  getMonthlySummary,
  listProfitability,
} from "@/features/finance/queries";
import { getCompanySettings } from "@/features/settings/queries";
import { todayInAppZone } from "@/lib/calendar";

export async function DashboardTab({ period }: { period: Period }) {
  // Mês corrente (o fechamento olha o mês que está acontecendo; o do dia 1 já veio na notificação).
  const monthStart = `${todayInAppZone().slice(0, 7)}-01`;
  const monthEnd = new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthStart}T12:00:00Z`));
  const [kpis, monthly, categories, margins, attention, cashFlow, negotiation, settings, belowTarget, latePayments] = await Promise.all([
    getDashboardKpis(period),
    getMonthlySummary(),
    getCategoryCosts(period),
    listProfitability(),
    getAttentionItems(),
    getCashFlowProjection(),
    getDealsInNegotiation(),
    getCompanySettings(),
    getMarginBelowTarget(),
    getLatePayments(monthStart, monthEnd),
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

      <div className="grid gap-4 xl:grid-cols-2">
        <MarginBelowTargetReport items={belowTarget} thresholds={settings.margin} />
        <LatePaymentsReport items={latePayments} monthLabel={monthLabel} />
      </div>

      <section aria-labelledby="attention-now-title" className="space-y-3">
        <h2 id="attention-now-title" className="section-title">
          Atenção agora
        </h2>
        <AttentionList items={attention} />
      </section>
    </div>
  );
}
