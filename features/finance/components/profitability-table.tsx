import Link from "next/link";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { Scale } from "lucide-react";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { formatCents } from "@/features/finance/money";
import type { ProfitabilityItem } from "@/features/finance/types";
import { formatDate } from "@/lib/format";
import { MARGIN_STATUS_TONE, toneColor } from "@/lib/status";

const dash = "—";

export function ProfitabilityTable({ rows }: { rows: ProfitabilityItem[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Scale} title="Nenhum projeto com movimentação financeira." hint="Defina o valor do contrato ou lance recebimentos e custos." />;
  }

  return (
    <TableShell minWidth="min-w-[1000px]">
      <thead>
        <tr>
          <Th>Projeto</Th>
          <Th>Entrega</Th>
          <Th align="right">Contrato</Th>
          <Th align="right">Recebido</Th>
          <Th align="right">A receber</Th>
          <Th align="right">Custos</Th>
          <Th align="right">Margem prevista</Th>
          <Th align="right">Margem %</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.projectId}>
            <td className="px-4 py-3">
              <Link href={`/projetos/${row.projectId}?aba=financeiro`} className="font-semibold hover:underline">
                {row.projectName}
              </Link>
              <span className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
                <ClientAvatar name={row.companyName ?? "Além Filmes"} logoUrl={row.companyLogoUrl} size="sm" />
                {row.companyName ?? "Interno — Além Filmes"}
              </span>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{row.dueDate ? formatDate(row.dueDate) : dash}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{row.contractValue != null ? formatCents(row.contractValue) : dash}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.totalReceived)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.receivablePending)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.payablesTotal)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{row.plannedMargin != null ? formatCents(row.plannedMargin) : dash}</td>
            <td
              className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums"
              style={row.marginStatus ? { color: toneColor(MARGIN_STATUS_TONE[row.marginStatus]) } : undefined}
            >
              {row.marginPct != null ? `${String(row.marginPct).replace(".", ",")}%` : dash}
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
