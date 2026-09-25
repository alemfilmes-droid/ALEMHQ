"use client";

import { useRouter } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { EmptyState } from "@/features/finance/components/table-shell";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/features/crm/labels";
import type { StageConversionItem } from "@/features/crm/types";
import { CHART_AXIS_TICK, CHART_GRID, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { toneColor } from "@/lib/status";
import type { DealStage } from "@/types";

interface ChartRow {
  stage: DealStage;
  count: number;
  averageDaysInStage: number | null;
}

function stageColor(stage: DealStage) {
  if (stage === "ganho") return toneColor("success") ?? "var(--muted-foreground)";
  if (stage === "perdido") return toneColor("danger") ?? "var(--muted-foreground)";
  if (["reuniao_agendada", "reuniao_realizada", "proposta_enviada", "negociacao"].includes(stage)) {
    return toneColor("warning") ?? "var(--muted-foreground)";
  }
  return "var(--border-strong)";
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload?: ChartRow }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{DEAL_STAGE_LABELS[row.stage]}</p>
      <p>{row.count} negócio(s)</p>
      {row.averageDaysInStage != null ? <p>Média de {row.averageDaysInStage} dia(s) na etapa</p> : null}
    </div>
  );
}

/** Funil por etapa: contagem (barra) e tempo médio na etapa (tooltip). Clicar filtra Leads por ela. */
export function StageFunnelChart({ data }: { data: StageConversionItem[] }) {
  const router = useRouter();
  const byStage = new Map(data.map((item) => [item.stage, item]));
  const rows: ChartRow[] = DEAL_STAGES.map((stage) => ({
    stage,
    count: byStage.get(stage)?.count ?? 0,
    averageDaysInStage: byStage.get(stage)?.averageDaysInStage ?? null,
  }));

  if (rows.every((row) => row.count === 0)) {
    return (
      <ChartCard title="Funil por etapa" titleId="funil-title">
        <EmptyState icon={KanbanSquare} title="Nenhum negócio cadastrado ainda." />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Funil por etapa" note="Passe o mouse para ver o tempo médio na etapa" titleId="funil-title">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis
            dataKey="stage"
            tickFormatter={(value: DealStage) => DEAL_STAGE_LABELS[value]}
            tick={{ ...CHART_AXIS_TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={70}
          />
          <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(entry: { payload: ChartRow }) => router.push(`/crm?aba=leads&etapa=${entry.payload.stage}`)}
          >
            {rows.map((row) => (
              <Cell key={row.stage} fill={stageColor(row.stage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
