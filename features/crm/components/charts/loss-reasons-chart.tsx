"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { XCircle } from "lucide-react";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { EmptyState } from "@/features/finance/components/table-shell";
import { DEAL_LOSS_REASON_LABELS } from "@/features/crm/labels";
import type { LossReasonItem } from "@/features/crm/types";
import { CHART_AXIS_TICK, CHART_EXPENSE, CHART_GRID, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import type { DealLossReason } from "@/types";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload?: LossReasonItem }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="font-bold">{DEAL_LOSS_REASON_LABELS[item.reason]}</p>
      <p>{item.count} negócio(s)</p>
    </div>
  );
}

/** Motivos de perda no período, do mais para o menos frequente. Clicar filtra Leads por ele. */
export function LossReasonsChart({ data }: { data: LossReasonItem[] }) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <ChartCard title="Motivos de perda">
        <EmptyState icon={XCircle} title="Nenhum negócio perdido no período." />
      </ChartCard>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ChartCard title="Motivos de perda" note="Negócios perdidos no período">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="reason"
            tickFormatter={(value: DealLossReason) => DEAL_LOSS_REASON_LABELS[value]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
          <Bar
            dataKey="count"
            fill={CHART_EXPENSE}
            radius={[0, 3, 3, 0]}
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/crm?aba=leads&etapa=perdido")}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
