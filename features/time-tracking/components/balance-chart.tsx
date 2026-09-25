"use client";

import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/time-tracking/components/chart-card";
import { CHART_AXIS_TICK, CHART_GRID, CHART_NEGATIVE, CHART_POSITIVE, CHART_TOOLTIP_STYLE } from "@/features/time-tracking/chart-colors";
import { formatDayMonth, formatMinutes } from "@/features/time-tracking/format";

interface BalanceChartProps {
  data: { workDate: string; balanceMinutes: number }[];
}

function withSignSplit(data: BalanceChartProps["data"]) {
  return data.map((item) => ({
    workDate: item.workDate,
    positive: item.balanceMinutes >= 0 ? item.balanceMinutes : null,
    negative: item.balanceMinutes < 0 ? item.balanceMinutes : null,
    balanceMinutes: item.balanceMinutes,
  }));
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{formatDayMonth(label ?? "")}</p>
      <p style={{ color: value >= 0 ? CHART_POSITIVE : CHART_NEGATIVE }}>Saldo: {formatMinutes(value)}</p>
    </div>
  );
}

export function BalanceChart({ data }: BalanceChartProps) {
  const chartData = withSignSplit(data);
  return (
    <ChartCard title="Evolução do saldo" note="Últimos 30 dias">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="workDate" tickFormatter={formatDayMonth} tick={CHART_AXIS_TICK} axisLine={{ stroke: CHART_GRID }} tickLine={false} interval={4} />
          <YAxis tickFormatter={(value: number) => formatMinutes(value)} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="positive" name="Saldo positivo" stroke={CHART_POSITIVE} strokeWidth={2} fill={CHART_POSITIVE} fillOpacity={0.16} connectNulls={false} />
          <Area type="monotone" dataKey="negative" name="Saldo negativo" stroke={CHART_NEGATIVE} strokeWidth={2} fill={CHART_NEGATIVE} fillOpacity={0.16} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
