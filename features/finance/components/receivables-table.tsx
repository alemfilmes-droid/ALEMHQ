"use client";

import { Money } from "@/components/ui/money";
import { useState } from "react";
import Link from "next/link";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { ArrowDownLeft, CheckCircle2, ExternalLink, MoreHorizontal, Paperclip, Pencil, XCircle } from "lucide-react";
import { attachReceivableInvoiceAction, cancelReceivableAction } from "@/features/finance/actions";
import { CancelDialog } from "@/features/finance/components/cancel-dialog";
import { CsvExportButton } from "@/features/finance/components/csv-export-button";
import { AttachInvoiceDialog, InvoiceFileButton } from "@/features/finance/components/invoice-controls";
import { ReceivableDialog } from "@/features/finance/components/receivable-dialog";
import { SettleReceivableDialog } from "@/features/finance/components/settle-dialogs";
import { DirectionIcon, StatusBadge } from "@/features/finance/components/status-badge";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from "@/features/finance/labels";
import { centsToInput, formatCents } from "@/features/finance/money";
import type { FinanceOptions, ReceivableItem } from "@/features/finance/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { NFSE_EMISSOR_URL } from "@/lib/links";

interface ReceivablesTableProps {
  rows: ReceivableItem[];
  options: FinanceOptions;
  today: string;
  /** Oculta as colunas de cliente/projeto (já implícitas na página). */
  compact?: boolean;
  /** No modo compacto, mostra o projeto sob a descrição (aba da empresa). */
  showProject?: boolean;
  csvName?: string;
}

function RowActions({ item, options, today }: { item: ReceivableItem; options: FinanceOptions; today: string }) {
  const [settleOpen, setSettleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  if (item.status === "cancelado") return null;
  // Nota fiscal vale antes e depois do recebimento; receber/editar/cancelar só em aberto.
  const open = item.status === "pendente" || item.status === "atrasado";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações para ${item.description}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {open ? (
            <DropdownMenuItem onSelect={() => setSettleOpen(true)}>
              <CheckCircle2 aria-hidden />
              Marcar como recebido
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <a href={NFSE_EMISSOR_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Emitir NFS-e (Emissor Nacional)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setInvoiceOpen(true)}>
            <Paperclip aria-hidden />
            {item.invoiceFilePath || item.invoiceNumber ? "Trocar nota fiscal" : "Anexar nota fiscal"}
          </DropdownMenuItem>
          {open ? (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCancelOpen(true)}>
                <XCircle aria-hidden />
                Cancelar
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {invoiceOpen ? (
        <AttachInvoiceDialog
          title="Nota fiscal do recebimento."
          description={`${item.companyName} · ${item.description} · ${formatCents(item.amount)}`}
          folder={`receivables/${item.id}`}
          initialNumber={item.invoiceNumber}
          hasFile={!!item.invoiceFilePath}
          onSave={(input) => attachReceivableInvoiceAction(item.id, input)}
          onOpenChange={setInvoiceOpen}
        />
      ) : null}
      {settleOpen ? <SettleReceivableDialog receivable={item} open onOpenChange={setSettleOpen} today={today} /> : null}
      {editOpen ? <ReceivableDialog mode="edit" receivable={item} options={options} today={today} open onOpenChange={setEditOpen} /> : null}
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar recebimento."
        description={`${item.description} · ${formatCents(item.amount)}. O registro é mantido como cancelado.`}
        onConfirm={() => cancelReceivableAction(item.id)}
      />
    </>
  );
}

export function ReceivablesTable({ rows, options, today, compact = false, showProject = false, csvName = "recebimentos.csv" }: ReceivablesTableProps) {
  if (rows.length === 0) {
    return <EmptyState icon={ArrowDownLeft} title="Nenhum recebimento encontrado." hint="Ajuste os filtros ou o período." />;
  }

  const csvHeaders = [
    "Vencimento",
    "Cliente",
    "Projeto",
    "Descrição",
    "Descrição do serviço",
    "Competência",
    "Parcela",
    "Valor",
    "Status",
    "Recebido em",
    "Valor recebido",
    "Forma",
    "Nota fiscal",
  ];
  const csvRows = rows.map((item) => [
    formatDate(item.dueDate),
    item.companyName,
    item.projectName ?? "",
    item.description,
    item.serviceDescription ?? "",
    item.competenceMonth ? formatDate(item.competenceMonth) : "",
    item.installmentNumber ? `${item.installmentNumber}/${item.installmentTotal}` : "",
    centsToInput(item.amount),
    STATUS_LABELS[item.status],
    item.receivedAt ? formatDate(item.receivedAt) : "",
    item.receivedAmount != null ? centsToInput(item.receivedAmount) : "",
    item.paymentMethod ? PAYMENT_METHOD_LABELS[item.paymentMethod] : "",
    item.invoiceNumber ?? "",
  ]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CsvExportButton filename={csvName} headers={csvHeaders} rows={csvRows} />
      </div>
      <TableShell minWidth={compact ? "min-w-[720px]" : "min-w-[980px]"}>
        <thead>
          <tr>
            <Th>Vencimento</Th>
            {compact ? null : <Th>Cliente</Th>}
            <Th>Descrição</Th>
            <Th align="right">Valor</Th>
            <Th>Status</Th>
            <Th>Forma</Th>
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
                  <DirectionIcon direction="in" />
                  {formatDate(item.dueDate)}
                </span>
              </td>
              {compact ? null : (
                <td className="px-4 py-3">
                  <Link href={`/clientes/${item.companyId}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                    <ClientAvatar name={item.companyName} logoUrl={item.companyLogoUrl} size="sm" />
                    {item.companyName}
                  </Link>
                  {item.projectId ? (
                    <Link href={`/projetos/${item.projectId}`} className="block text-[13px] text-muted-foreground hover:underline">
                      {item.projectName}
                    </Link>
                  ) : null}
                </td>
              )}
              <td className="px-4 py-3">
                <span className={item.status === "cancelado" ? "line-through" : "font-semibold"}>{item.description}</span>
                {compact && showProject && item.projectName ? (
                  <span className="block text-[13px] text-muted-foreground">{item.projectName}</span>
                ) : null}
                {item.invoiceNumber || item.invoiceFilePath ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                    {item.invoiceNumber ? `NF ${item.invoiceNumber}` : "NF anexada"}
                    {item.invoiceFilePath ? <InvoiceFileButton path={item.invoiceFilePath} label="abrir" size="sm" variant="link" /> : null}
                  </span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
                <Money cents={item.status === "recebido" && item.receivedAmount != null ? item.receivedAmount : item.amount} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
                {item.receivedAt ? <span className="mt-1 block text-[12px] text-muted-foreground">em {formatDate(item.receivedAt)}</span> : null}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{item.paymentMethod ? PAYMENT_METHOD_LABELS[item.paymentMethod] : "—"}</td>
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
