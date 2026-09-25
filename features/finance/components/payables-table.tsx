"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, MoreHorizontal, Pencil, XCircle } from "lucide-react";
import { cancelPayableAction } from "@/features/finance/actions";
import { CancelDialog } from "@/features/finance/components/cancel-dialog";
import { CsvExportButton } from "@/features/finance/components/csv-export-button";
import { PayableDialog } from "@/features/finance/components/payable-dialog";
import { SettlePayableDialog } from "@/features/finance/components/settle-dialogs";
import { DirectionIcon, StatusBadge } from "@/features/finance/components/status-badge";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { FIXED_VARIABLE_LABELS, PAYABLE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, STATUS_LABELS } from "@/features/finance/labels";
import { centsToInput, formatCents } from "@/features/finance/money";
import type { FinanceOptions, PayableItem } from "@/features/finance/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";

interface PayablesTableProps {
  rows: PayableItem[];
  options: FinanceOptions;
  today: string;
  /** Oculta a coluna de projeto (aba do projeto). */
  compact?: boolean;
  csvName?: string;
}

function RowActions({ item, options, today }: { item: PayableItem; options: FinanceOptions; today: string }) {
  const [settleOpen, setSettleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  if (item.status !== "pendente" && item.status !== "atrasado") return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações para ${item.description}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setSettleOpen(true)}>
            <CheckCircle2 aria-hidden />
            Marcar como pago
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCancelOpen(true)}>
            <XCircle aria-hidden />
            Cancelar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {settleOpen ? <SettlePayableDialog payable={item} open onOpenChange={setSettleOpen} today={today} /> : null}
      {editOpen ? (
        <PayableDialog mode="edit" payable={item} options={options} today={today} lockedProjectId={item.projectId ?? undefined} open onOpenChange={setEditOpen} />
      ) : null}
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar pagamento."
        description={`${item.description} · ${formatCents(item.amount)}. O registro é mantido como cancelado.`}
        onConfirm={() => cancelPayableAction(item.id)}
      />
    </>
  );
}

export function PayablesTable({ rows, options, today, compact = false, csvName = "pagamentos.csv" }: PayablesTableProps) {
  if (rows.length === 0) {
    return <EmptyState icon={ArrowUpRight} title="Nenhum pagamento encontrado." hint="Ajuste os filtros ou o período." />;
  }

  const csvHeaders = ["Vencimento", "Projeto", "Favorecido", "Categoria", "Fixo/Variável", "Descrição", "Valor", "Status", "Pago em", "Forma"];
  const csvRows = rows.map((item) => [
    formatDate(item.dueDate),
    item.projectName ?? "Despesa geral",
    item.payeeLabel,
    PAYABLE_CATEGORY_LABELS[item.category],
    item.isFixed ? FIXED_VARIABLE_LABELS.fixed : FIXED_VARIABLE_LABELS.variable,
    item.description,
    centsToInput(item.amount),
    STATUS_LABELS[item.status],
    item.paidAt ? formatDate(item.paidAt) : "",
    item.paymentMethod ? PAYMENT_METHOD_LABELS[item.paymentMethod] : "",
  ]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CsvExportButton filename={csvName} headers={csvHeaders} rows={csvRows} />
      </div>
      <TableShell minWidth={compact ? "min-w-[760px]" : "min-w-[1000px]"}>
        <thead>
          <tr>
            <Th>Vencimento</Th>
            <Th>Favorecido</Th>
            <Th>Descrição</Th>
            {compact ? null : <Th>Projeto</Th>}
            <Th align="right">Valor</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((item) => (
            <tr key={item.id} className={item.status === "cancelado" ? "text-subtle" : undefined}>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="flex items-center gap-3">
                  <DirectionIcon direction="out" />
                  {formatDate(item.dueDate)}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold">{item.payeeLabel}</td>
              <td className="px-4 py-3">
                <span className={item.status === "cancelado" ? "line-through" : undefined}>{item.description}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="muted">{PAYABLE_CATEGORY_LABELS[item.category]}</Badge>
                  <Badge variant="outline">{item.isFixed ? FIXED_VARIABLE_LABELS.fixed : FIXED_VARIABLE_LABELS.variable}</Badge>
                  {item.recurrence !== "none" || item.recurrenceParentId ? <Badge variant="outline">Recorrente</Badge> : null}
                </span>
              </td>
              {compact ? null : (
                <td className="px-4 py-3 text-muted-foreground">
                  {item.projectId ? (
                    <Link href={`/projetos/${item.projectId}`} className="hover:underline">
                      {item.projectName}
                    </Link>
                  ) : (
                    "Despesa geral"
                  )}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatCents(item.amount)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
                {item.paidAt ? <span className="mt-1 block text-[12px] text-muted-foreground">em {formatDate(item.paidAt)}</span> : null}
              </td>
              <td className="px-2 py-3 text-right">
                <RowActions item={item} options={options} today={today} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
