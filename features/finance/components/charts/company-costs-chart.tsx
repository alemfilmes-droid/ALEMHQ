"use client";

import { Money } from "@/components/ui/money";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import type { CompanyCostMonth } from "@/features/finance/company-costs";
import { formatCentsCompact } from "@/features/finance/money";
import { CHART_AXIS_TICK, CHART_GRID, CHART_INCOME, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { formatMonthShort } from "@/lib/format";

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload?: CompanyCostMonth }[];
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{formatMonthShort(`${label ?? item.month}-01`)}</p>
      <p>Fixos: <Money cents={item.fixed} /></p>
      <p>Variáveis: <Money cents={item.variable} /></p>
      <p>Faturamento: <Money cents={item.revenue} /></p>
      <p className="mt-1 font-semibold">
        Fixos / faturamento: {item.fixedShare == null ? "—" : `${String(item.fixedShare).replace(".", ",")}%`}
      </p>
    </div>
  );
}

/** 12 meses: custos fixos (sólido) e variáveis (claro) empilhados, com o faturamento como linha. */
export function CompanyCostsChart({ data }: { data: CompanyCostMonth[] }) {
  return (
    <ChartCard title="Evolução em 12 meses" note="Custos da empresa x faturamento, pelo vencimento">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="month" tickFormatter={(value: string) => formatMonthShort(`${value}-01`)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis className="sensitive-axis" tickFormatter={formatCentsCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={72} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Bar dataKey="fixed" name="Fixos" stackId="c" fill="var(--muted-foreground)" />
          <Bar dataKey="variable" name="Variáveis" stackId="c" fill="var(--border-strong)" radius={[3, 3, 0, 0]} />
          <Line dataKey="revenue" name="Faturamento" type="monotone" stroke={CHART_INCOME} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
