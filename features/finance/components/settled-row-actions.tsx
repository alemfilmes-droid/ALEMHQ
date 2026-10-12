"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReverseSettlementDialog } from "@/features/finance/components/reverse-settlement-dialog";
import { SettledPayableDialog } from "@/features/finance/components/settled-payable-dialog";
import { SettledReceivableDialog } from "@/features/finance/components/settled-receivable-dialog";
import { formatCents } from "@/features/finance/money";
import type { FinanceOptions, PayableItem, ReceivableItem } from "@/features/finance/types";

type Entry = { kind: "payable"; item: PayableItem } | { kind: "receivable"; item: ReceivableItem };

function entryLabel(entry: Entry): string {
  const who = entry.kind === "payable" ? entry.item.payeeLabel : entry.item.companyName;
  return `${who} · ${entry.item.description} · ${formatCents(entry.item.amount)}`;
}

/** Abre "Editar" ou "Estornar baixa" de um lançamento já baixado (menu da linha e janela do pagamento). */
export function useSettledEntryDialogs(entry: Entry, options: FinanceOptions) {
  const [editOpen, setEditOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const dialogs = (
    <>
      {editOpen && entry.kind === "payable" ? (
        <SettledPayableDialog payable={entry.item} options={options} open onOpenChange={setEditOpen} />
      ) : null}
      {editOpen && entry.kind === "receivable" ? <SettledReceivableDialog receivable={entry.item} options={options} open onOpenChange={setEditOpen} /> : null}
      {reverseOpen ? (
        <ReverseSettlementDialog type={entry.kind} id={entry.item.id} version={entry.item.version} label={entryLabel(entry)} open onOpenChange={setReverseOpen} />
      ) : null}
    </>
  );
  return { openEdit: () => setEditOpen(true), openReverse: () => setReverseOpen(true), dialogs };
}

/** Menu ⋯ da linha de um lançamento baixado — só para a diretoria e o squad financeiro. */
export function SettledRowActions({ entry, options }: { entry: Entry; options: FinanceOptions }) {
  const { openEdit, openReverse, dialogs } = useSettledEntryDialogs(entry, options);
  if (!options.canEditSettled) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 sm:size-10" aria-label={`Ações para ${entry.item.description}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openEdit}>
            <Pencil aria-hidden />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openReverse}>
            <Undo2 aria-hidden />
            Estornar baixa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
