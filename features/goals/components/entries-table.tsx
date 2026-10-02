"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ExternalLink, ListPlus, MoreHorizontal, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, TableShell, Th } from "@/features/finance/components/table-shell";
import { deleteEntryAction, reviewEntriesAction } from "@/features/goals/actions";
import { EntryFormDialog } from "@/features/goals/components/entry-form-dialog";
import { formatGoalValue } from "@/features/goals/progress";
import { ENTRY_SOURCE_LABELS, ENTRY_STATUS_LABELS, ENTRY_STATUS_TONE, type GoalEntryItem, type GoalItem } from "@/features/goals/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface EntriesTableProps {
  goal: GoalItem;
  entries: GoalEntryItem[];
  isManager: boolean;
  isOwner: boolean;
}

const OPEN = new Set<GoalItem["status"]>(["ativa", "em_revisao"]);

function RejectDialog({ count, onConfirm, onOpenChange }: { count: number; onConfirm: (note: string) => void; onOpenChange: (open: boolean) => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{count > 1 ? `Recusar ${count} lançamentos.` : "Recusar lançamento."}</DialogTitle>
          <DialogDescription>O responsável recebe o motivo na notificação.</DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Motivo" rows={3} maxLength={500} placeholder="Ex.: negócio ainda não assinado." value={note} onChange={(event) => setNote(event.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={() => onConfirm(note)}>Recusar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lançamentos da meta. Diretoria seleciona e aprova/recusa em lote; o responsável edita os seus pendentes. */
export function EntriesTable({ goal, entries, isManager, isOwner }: EntriesTableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<GoalEntryItem | "new" | null>(null);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const open = OPEN.has(goal.status);
  const canAdd = open && (isManager || (isOwner && goal.status === "ativa"));
  const pendingIds = entries.filter((entry) => entry.status === "pendente").map((entry) => entry.id);
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.includes(id));

  function review(ids: string[], status: "aprovado" | "recusado" | "pendente", note?: string) {
    startTransition(async () => {
      const result = await reviewEntriesAction(goal.id, ids, status, note);
      if (result.ok) {
        toast.success(result.message);
        setSelected((current) => current.filter((id) => !ids.includes(id)));
        setRejecting(null);
      } else toast.error(result.error);
    });
  }

  function remove(entry: GoalEntryItem) {
    startTransition(async () => {
      const result = await deleteEntryAction(goal.id, entry.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <section aria-labelledby="lancamentos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lancamentos" className="section-title">
          Lançamentos
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {isManager && open && selected.length > 0 ? (
            <>
              <Button size="sm" variant="secondary" loading={pending} onClick={() => review(selected, "aprovado")}>
                <Check aria-hidden />
                Aprovar {selected.length}
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(selected)}>
                <X aria-hidden />
                Recusar
              </Button>
            </>
          ) : null}
          {canAdd ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <ListPlus aria-hidden />
              Lançar
            </Button>
          ) : null}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Nenhum lançamento ainda."
          hint={goal.autoFromCrm ? "O que o responsável fizer no CRM entra aqui sozinho." : "Os lançamentos do responsável aparecem aqui para revisão."}
        />
      ) : (
        <TableShell minWidth="min-w-[760px]">
          <thead>
            <tr>
              {isManager && open ? (
                <th scope="col" className="w-10 border-b border-border px-4 py-3">
                  <Checkbox
                    aria-label="Selecionar todos os pendentes"
                    checked={allPendingSelected}
                    disabled={pendingIds.length === 0}
                    onCheckedChange={() => setSelected(allPendingSelected ? [] : pendingIds)}
                  />
                </th>
              ) : null}
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th align="right">{goal.isMoney ? "Valor" : "Qtd."}</Th>
              <Th>Situação</Th>
              <Th>
                <span className="sr-only">Ações</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => {
              const ownEditable = isOwner && entry.status === "pendente" && entry.source === "manual" && goal.status === "ativa";
              const showMenu = open && (isManager || ownEditable);
              return (
                <tr key={entry.id} className={cn(entry.status === "recusado" && "text-subtle")}>
                  {isManager && open ? (
                    <td className="px-4 py-3">
                      {entry.status === "pendente" ? (
                        <Checkbox aria-label="Selecionar lançamento" checked={selected.includes(entry.id)} onCheckedChange={() => toggle(entry.id)} />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(entry.entryDate)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("block", entry.status === "recusado" && "line-through")}>{entry.note || "—"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle">
                      <Badge variant="muted">{ENTRY_SOURCE_LABELS[entry.source]}</Badge>
                      {entry.createdByName && entry.source === "manual" ? <span>por {entry.createdByName}</span> : null}
                      {entry.dealId ? (
                        <Link href={`/crm?aba=leads&negocio=${entry.dealId}`} className="underline underline-offset-2 hover:text-foreground">
                          Ver negócio
                        </Link>
                      ) : null}
                      {entry.linkUrl ? (
                        <a href={entry.linkUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
                          Comprovante
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  </td>
                  <td data-sensitive={goal.isMoney ? "money" : undefined} className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
                    {formatGoalValue(goal, entry.amount, false)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <StatusDot tone={ENTRY_STATUS_TONE[entry.status]} />
                      {ENTRY_STATUS_LABELS[entry.status]}
                    </span>
                    {entry.reviewNote ? <span className="mt-1 block max-w-[16rem] text-[12px] text-muted-foreground">{entry.reviewNote}</span> : null}
                    {entry.reviewedAt && entry.reviewerName ? (
                      <span className="mt-0.5 block text-[12px] text-subtle">por {entry.reviewerName}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {showMenu ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações do lançamento" disabled={pending}>
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isManager && entry.status !== "aprovado" ? (
                            <DropdownMenuItem onSelect={() => review([entry.id], "aprovado")}>
                              <Check aria-hidden />
                              Aprovar
                            </DropdownMenuItem>
                          ) : null}
                          {isManager && entry.status !== "recusado" ? (
                            <DropdownMenuItem onSelect={() => setRejecting([entry.id])}>
                              <X aria-hidden />
                              Recusar
                            </DropdownMenuItem>
                          ) : null}
                          {isManager && entry.status !== "pendente" ? (
                            <DropdownMenuItem onSelect={() => review([entry.id], "pendente")}>
                              <RotateCcw aria-hidden />
                              Voltar para a confirmar
                            </DropdownMenuItem>
                          ) : null}
                          {(isManager || ownEditable) && entry.source === "manual" ? (
                            <DropdownMenuItem onSelect={() => setEditing(entry)}>
                              <Pencil aria-hidden />
                              Editar
                            </DropdownMenuItem>
                          ) : null}
                          {isManager || ownEditable ? (
                            <DropdownMenuItem onSelect={() => remove(entry)}>
                              <Trash2 aria-hidden />
                              Apagar
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      {editing ? (
        <EntryFormDialog goal={goal} entry={editing === "new" ? undefined : editing} isManager={isManager} onOpenChange={(next) => !next && setEditing(null)} />
      ) : null}
      {rejecting ? (
        <RejectDialog count={rejecting.length} onConfirm={(note) => review(rejecting, "recusado", note)} onOpenChange={(next) => !next && setRejecting(null)} />
      ) : null}
    </section>
  );
}
