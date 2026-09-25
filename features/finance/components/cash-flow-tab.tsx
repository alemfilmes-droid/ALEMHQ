import { AlertTriangle } from "lucide-react";
import { CashFlowChart } from "@/features/finance/components/charts/cash-flow-chart";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { formatCents } from "@/features/finance/money";
import { getCashFlowProjection } from "@/features/finance/queries";
import type { CashFlowDay } from "@/features/finance/types";
import { formatDate } from "@/lib/format";
import { toneColor } from "@/lib/status";

function toWeeks(days: CashFlowDay[]) {
  const weeks: { start: string; end: string; inflow: number; outflow: number; endBalance: number; wentNegative: boolean }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;
    weeks.push({
      start: first.day,
      end: last.day,
      inflow: chunk.reduce((total, day) => total + day.expectedInflow, 0),
      outflow: chunk.reduce((total, day) => total + day.expectedOutflow, 0),
      endBalance: last.runningBalance,
      wentNegative: chunk.some((day) => day.runningBalance < 0),
    });
  }
  return weeks;
}

export async function CashFlowTab() {
  const days = await getCashFlowProjection();
  const weeks = toWeeks(days);

  return (
    <div className="space-y-6">
      <CashFlowChart data={days} />

      {weeks.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Sem lançamentos previstos nos próximos 90 dias." />
      ) : (
        <TableShell minWidth="min-w-[720px]">
          <thead>
            <tr>
              <Th>Semana</Th>
              <Th align="right">Entradas previstas</Th>
              <Th align="right">Saídas previstas</Th>
              <Th align="right">Saldo ao final</Th>
              <Th>Situação</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {weeks.map((week) => (
              <tr key={week.start}>
                <td className="whitespace-nowrap px-4 py-3">
                  {formatDate(week.start)} – {formatDate(week.end)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums" style={{ color: toneColor("success") }}>
                  {formatCents(week.inflow)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums" style={{ color: toneColor("danger") }}>
                  {formatCents(week.outflow)}
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums"
                  style={{ color: toneColor(week.endBalance >= 0 ? "success" : "danger") }}
                >
                  {formatCents(week.endBalance)}
                </td>
                <td className="px-4 py-3">
                  {week.wentNegative ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: toneColor("danger") }}>
                      <AlertTriangle className="size-3.5" aria-hidden />
                      Saldo fica negativo
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Regular</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
