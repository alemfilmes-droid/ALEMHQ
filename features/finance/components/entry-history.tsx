"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEntryHistoryAction } from "@/features/finance/settled-actions";
import type { FinanceHistoryEntry, FinanceOptions } from "@/features/finance/types";
import { formatHistoryValue, historyFieldLabel, type FinanceEntryType, type NameLookup } from "@/lib/finance/settled-edit";
import { formatDateTime } from "@/lib/format";

const ACTION_LABELS: Record<FinanceHistoryEntry["action"], string> = {
  EDIT: "Editou",
  REVERSE_WRITE_OFF: "Estornou a baixa",
};

function lookupFrom(options: FinanceOptions): NameLookup {
  return (field, id) => {
    if (field === "company_id") return options.companies.find((item) => item.id === id)?.name;
    if (field === "project_id") return options.projects.find((item) => item.id === id)?.name;
    return options.members.find((item) => item.id === id)?.full_name;
  };
}

/** "Histórico de alterações": quem, quando (Fortaleza), campo antes → depois e motivo. */
export function EntryHistoryList({ type, id, options }: { type: FinanceEntryType; id: string; options: FinanceOptions }) {
  const [entries, setEntries] = useState<FinanceHistoryEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    getEntryHistoryAction(type, id)
      .then((rows) => active && setEntries(rows))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [type, id]);

  if (entries === null) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma alteração depois da baixa.</p>;

  const lookup = lookupFrom(options);
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="space-y-1.5 rounded-md border border-border bg-surface-raised p-3 text-sm">
          <p className="font-semibold">
            {ACTION_LABELS[entry.action]} · {entry.changedByName}
            <span className="font-normal text-muted-foreground"> · {formatDateTime(entry.changedAt)}</span>
          </p>
          <ul className="space-y-0.5 break-words text-[13px]">
            {Object.entries(entry.changes).map(([field, change]) => (
              <li key={field}>
                <span className="text-muted-foreground">{historyFieldLabel(field)}:</span> {formatHistoryValue(field, change.before, lookup)} →{" "}
                <span className="font-semibold">{formatHistoryValue(field, change.after, lookup)}</span>
              </li>
            ))}
          </ul>
          {entry.reason ? <p className="text-[13px] text-muted-foreground">Motivo: {entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/** Etiqueta discreta "Editado" em lançamentos com histórico; abre o histórico. */
export function EditedTag({ type, id, label, options }: { type: FinanceEntryType; id: string; label: string; options: FinanceOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1 rounded-full px-1 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:min-h-0"
        aria-label={`Editado — ver histórico de alterações de ${label}`}
      >
        <History className="size-3" aria-hidden />
        Editado
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Histórico de alterações.</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          {open ? <EntryHistoryList type={type} id={id} options={options} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
