"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { ArrowDown, ArrowUp, Building2 } from "lucide-react";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { formatCents } from "@/features/finance/money";
import type { ClientFinanceRow } from "@/features/finance/types";
import { MARGIN_STATUS_TONE, toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";

const dash = "—";

type SortKey = "companyName" | "totalBilled" | "totalReceived" | "totalPending" | "totalCosts" | "marginPct" | "projectCount";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "companyName", label: "Cliente" },
  { key: "totalBilled", label: "Faturado", align: "right" },
  { key: "totalReceived", label: "Recebido", align: "right" },
  { key: "totalPending", label: "Pendente", align: "right" },
  { key: "totalCosts", label: "Custos", align: "right" },
  { key: "marginPct", label: "Margem", align: "right" },
  { key: "projectCount", label: "Projetos", align: "right" },
];

/** Faturamento, recebido, pendente, custos e margem por cliente. Cabeçalhos ordenam; clicar na linha abre o cliente. */
export function ClientFinanceTable({ rows }: { rows: ClientFinanceRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "totalBilled", desc: true });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const na = va == null ? -Infinity : va;
      const nb = vb == null ? -Infinity : vb;
      const cmp = typeof na === "string" && typeof nb === "string" ? na.localeCompare(nb) : Number(na) - Number(nb);
      return sort.desc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sort]);

  if (rows.length === 0) {
    return <EmptyState icon={Building2} title="Nenhum cliente com movimentação financeira." hint="Lance recebimentos ou custos vinculados a um cliente." />;
  }

  function toggleSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, desc: !current.desc } : { key, desc: true }));
  }

  return (
    <TableShell minWidth="min-w-[900px]">
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <Th key={column.key} align={column.align}>
              <button
                type="button"
                onClick={() => toggleSort(column.key)}
                className={cn("inline-flex items-center gap-1 hover:text-foreground", column.align === "right" && "flex-row-reverse")}
              >
                {column.label}
                {sort.key === column.key ? sort.desc ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden /> : null}
              </button>
            </Th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {sorted.map((row) => (
          <tr key={row.companyId} className="hover:bg-surface-hover">
            <td className="px-4 py-3 font-semibold">
              <Link href={`/clientes/${row.companyId}?aba=financeiro`} className="inline-flex items-center gap-2 hover:underline">
                <ClientAvatar name={row.companyName} logoUrl={row.companyLogoUrl} size="sm" />
                {row.companyName}
              </Link>
            </td>
            <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.totalBilled)}</td>
            <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.totalReceived)}</td>
            <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.totalPending)}</td>
            <td data-sensitive className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCents(row.totalCosts)}</td>
            <td
              data-sensitive="percent"
              className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums"
              style={row.marginStatus ? { color: toneColor(MARGIN_STATUS_TONE[row.marginStatus]) } : undefined}
            >
              {row.marginPct != null ? `${String(row.marginPct).replace(".", ",")}%` : dash}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">{row.projectCount}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
