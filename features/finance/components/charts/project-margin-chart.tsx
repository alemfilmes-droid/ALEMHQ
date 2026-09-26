"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Layers } from "lucide-react";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { EmptyState } from "@/features/finance/components/table-shell";
import type { ProfitabilityItem } from "@/features/finance/types";
import { CHART_AXIS_TICK, CHART_GRID, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, toneColor } from "@/lib/status";

interface TooltipPayloadItem {
  payload?: ProfitabilityItem;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item || item.marginPct == null || !item.marginStatus) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{item.projectName}</p>
      <p style={{ color: toneColor(MARGIN_STATUS_TONE[item.marginStatus]) }}>
        {String(item.marginPct).replace(".", ",")}% — margem {MARGIN_STATUS_LABELS[item.marginStatus]}
      </p>
    </div>
  );
}

function truncate(name: string) {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

/** Uma barra por projeto, colorida pela situação da margem; linha de referência na meta. */
export function ProjectMarginChart({ data, target }: { data: ProfitabilityItem[]; target: number }) {
  const items = data.filter((item) => item.marginPct != null && item.marginStatus).slice(0, 12);

  if (items.length === 0) {
    return (
      <ChartCard title="Margem por projeto" note={`Meta: ${String(target).replace(".", ",")}% líquido`} titleId="margem-projeto-title">
        <EmptyState icon={Layers} title="Nenhum projeto com margem calculada." />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Margem por projeto" note={`Meta: ${String(target).replace(".", ",")}% líquido`} titleId="margem-projeto-title">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis className="sensitive-axis"
            type="number"
            tickFormatter={(value: number) => `${value}%`}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            // Projetos com custo acima do contrato têm margem negativa — o domínio precisa
            // incluir valores abaixo de zero, senão a barra fica com comprimento errado.
            domain={([dataMin, dataMax]: [number, number]) => [Math.min(dataMin, 0), Math.max(dataMax, target)]}
          />
          <ReferenceLine x={0} stroke="var(--border-strong)" strokeWidth={1.5} />
          <YAxis
            type="category"
            dataKey="projectName"
            tickFormatter={(value: string) => truncate(value)}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
          <ReferenceLine x={target} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "Margem saudável", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Bar dataKey="marginPct" name="Margem" radius={[0, 3, 3, 0]}>
            {items.map((item) => (
              <Cell key={item.projectId} fill={item.marginStatus ? toneColor(MARGIN_STATUS_TONE[item.marginStatus]) : "var(--subtle)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
