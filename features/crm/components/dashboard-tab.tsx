import { CommissionRulesCard } from "@/features/crm/components/commission-rules-card";
import { AttentionList } from "@/features/crm/components/attention-list";
import { CrmDashboardKpiRow } from "@/features/crm/components/dashboard-kpis";
import { LossReasonsChart } from "@/features/crm/components/charts/loss-reasons-chart";
import { StageFunnelChart } from "@/features/crm/components/charts/stage-funnel-chart";
import { WonValueChart } from "@/features/crm/components/charts/won-value-chart";
import { OwnerPerformanceTable } from "@/features/crm/components/owner-performance-table";
import {
  getDashboardKpis,
  getLossReasons,
  getMonthlyWonValue,
  getOwnerPerformance,
  getStageConversion,
  listCommissionRules,
  listDealsNeedingAttention,
} from "@/features/crm/queries";
import type { Period } from "@/features/finance/period";

export async function CrmDashboardTab({ period, canEditRules, canSeeFinance }: { period: Period; canEditRules: boolean; canSeeFinance: boolean }) {
  const [kpis, stageConversion, monthlyWon, lossReasons, ownerPerformance, attention, rules] = await Promise.all([
    getDashboardKpis(period),
    getStageConversion(),
    canSeeFinance ? getMonthlyWonValue() : Promise.resolve(null),
    getLossReasons(period),
    getOwnerPerformance(period),
    listDealsNeedingAttention(),
    canEditRules ? listCommissionRules() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <CrmDashboardKpiRow kpis={kpis} period={period} canSeeFinance={canSeeFinance} />

      <div className="grid gap-4 xl:grid-cols-2">
        <StageFunnelChart data={stageConversion} />
        {monthlyWon ? <WonValueChart data={monthlyWon} /> : null}
        <LossReasonsChart data={lossReasons} />
      </div>

      <section aria-labelledby="por-responsavel-title" className="space-y-3">
        <h2 id="por-responsavel-title" className="section-title">
          Por responsável
        </h2>
        <OwnerPerformanceTable data={ownerPerformance} />
      </section>

      <section aria-labelledby="atencao-title" className="space-y-3">
        <h2 id="atencao-title" className="section-title">
          Precisam de atenção
        </h2>
        <AttentionList items={attention} />
      </section>

      {canEditRules ? <CommissionRulesCard rules={rules} /> : null}
    </div>
  );
}
