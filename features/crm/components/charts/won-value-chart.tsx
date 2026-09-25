"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { EmptyState } from "@/features/finance/components/table-shell";
import type { MonthlyWonItem } from "@/features/crm/types";
import { formatCents, formatCentsCompact } from "@/features/finance/money";
import { CHART_AXIS_TICK, CHART_GRID, CHART_INCOME, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { formatMonthShort } from "@/lib/format";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{formatMonthShort(label)}</p>
      <p>{formatCents(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

/** Valor ganho por mês, últimos 12 meses. */
export function WonValueChart({ data }: { data: MonthlyWonItem[] }) {
  if (data.every((item) => item.totalValue === 0)) {
    return (
      <ChartCard title="Valor ganho por mês">
        <EmptyState icon={TrendingUp} title="Nenhum negócio ganho nos últimos 12 meses." />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Valor ganho por mês" note="Últimos 12 meses">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="monthStart" tickFormatter={formatMonthShort} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCentsCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)" }} />
          <Line type="monotone" dataKey="totalValue" stroke={CHART_INCOME} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
