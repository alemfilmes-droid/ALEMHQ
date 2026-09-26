"use client";

import { Money } from "@/components/ui/money";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { PAYABLE_CATEGORY_LABELS } from "@/features/finance/labels";
import { formatCentsCompact } from "@/features/finance/money";
import type { CategoryCostItem } from "@/features/finance/types";
import { CHART_AXIS_TICK, CHART_CATEGORY_COLORS, CHART_GRID, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { EmptyState } from "@/features/finance/components/table-shell";
import { Layers } from "lucide-react";

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
  payload?: CategoryCostItem;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const category = payload[0]?.payload;
  if (!category) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{PAYABLE_CATEGORY_LABELS[category.category]}</p>
      <p>Fixo: <Money cents={category.fixedTotal} /></p>
      <p>Variável: <Money cents={category.variableTotal} /></p>
    </div>
  );
}

/** Barra horizontal por categoria: preenchimento sólido = fixo, listrado = variável. Clicar filtra Pagamentos por ela. */
export function CategoryCostsChart({ data }: { data: CategoryCostItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToCategory(item: CategoryCostItem) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", "pagamentos");
    params.set("categoria", item.category);
    router.push(`/financeiro?${params.toString()}`);
  }

  if (data.length === 0) {
    return (
      <ChartCard title="Custos por categoria" note="Vencimento no período">
        <EmptyState icon={Layers} title="Sem custos no período." />
      </ChartCard>
    );
  }

  const sorted = [...data].sort((a, b) => b.fixedTotal + b.variableTotal - (a.fixedTotal + a.variableTotal));

  return (
    <ChartCard title="Custos por categoria" note="Sólido = fixo · listrado = variável">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {sorted.map((item) => (
              <pattern
                key={item.category}
                id={`stripes-${item.category}`}
                patternUnits="userSpaceOnUse"
                width={6}
                height={6}
                patternTransform="rotate(45)"
              >
                <rect width={6} height={6} fill="var(--surface-raised)" />
                <line x1={0} y1={0} x2={0} y2={6} stroke={CHART_CATEGORY_COLORS[item.category]} strokeWidth={3} />
              </pattern>
            ))}
          </defs>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis className="sensitive-axis" type="number" tickFormatter={formatCentsCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="category"
            tickFormatter={(value: CategoryCostItem["category"]) => PAYABLE_CATEGORY_LABELS[value]}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
          <Bar
            dataKey="fixedTotal"
            name="Fixo"
            stackId="a"
            radius={[0, 0, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(entry: { payload: CategoryCostItem }) => goToCategory(entry.payload)}
          >
            {sorted.map((item) => (
              <Cell key={item.category} fill={CHART_CATEGORY_COLORS[item.category]} />
            ))}
          </Bar>
          <Bar
            dataKey="variableTotal"
            name="Variável"
            stackId="a"
            radius={[0, 3, 3, 0]}
            style={{ cursor: "pointer" }}
            onClick={(entry: { payload: CategoryCostItem }) => goToCategory(entry.payload)}
          >
            {sorted.map((item) => (
              <Cell key={item.category} fill={`url(#stripes-${item.category})`} stroke={CHART_CATEGORY_COLORS[item.category]} strokeWidth={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
