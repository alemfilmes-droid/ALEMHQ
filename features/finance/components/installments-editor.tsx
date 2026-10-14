"use client";

import { Divide } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { centsToInput, formatCents, parseMoneyToCents, type Cents } from "@/features/finance/money";
import { checkInstallments, MAX_INSTALLMENTS, suggestInstallments, type InstallmentDraft } from "@/lib/budgets/approval";
import { cn } from "@/lib/utils";

/** Linha editável: o valor fica como texto ("1.234,56") até virar centavos. */
export interface InstallmentRow {
  amount: string;
  dueDate: string;
}

export function rowsFromDrafts(drafts: readonly InstallmentDraft[]): InstallmentRow[] {
  return drafts.map((draft) => ({ amount: centsToInput(draft.amountCents), dueDate: draft.dueDate }));
}

export function draftsFromRows(rows: readonly InstallmentRow[]): InstallmentDraft[] {
  return rows.map((row) => ({ amountCents: parseMoneyToCents(row.amount) ?? 0, dueDate: row.dueDate }));
}

export function suggestedRows(totalCents: Cents, count: number, firstDueDate: string): InstallmentRow[] {
  return rowsFromDrafts(suggestInstallments(totalCents, count, firstDueDate));
}

/**
 * Parcelas que precisam somar exatamente o total: quantidade + primeira data geram a sugestão (mês a mês, centavos
 * distribuídos); cada valor e data pode ser ajustado. A soma aparece ao vivo, com quanto falta ou sobra.
 */
export function InstallmentsEditor({ idPrefix, totalCents, rows, onChange }: { idPrefix: string; totalCents: Cents; rows: InstallmentRow[]; onChange: (rows: InstallmentRow[]) => void }) {
  const check = checkInstallments(totalCents, draftsFromRows(rows));
  const firstDate = rows[0]?.dueDate ?? "";

  function setCount(value: string) {
    const count = Math.max(1, Math.min(MAX_INSTALLMENTS, Number(value) || 1));
    onChange(suggestedRows(totalCents, count, firstDate));
  }

  function update(index: number, patch: Partial<InstallmentRow>) {
    onChange(rows.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${idPrefix}-count`} label="Parcelas">
          <Input id={`${idPrefix}-count`} type="number" inputMode="numeric" min={1} max={MAX_INSTALLMENTS} className="h-11" value={rows.length} onChange={(event) => setCount(event.target.value)} />
        </FormField>
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="h-11 w-full" onClick={() => onChange(suggestedRows(totalCents, rows.length, firstDate))}>
            <Divide aria-hidden />
            Dividir igual
          </Button>
        </div>
      </div>

      <ol className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2">
            <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
              {index + 1}/{rows.length}
            </span>
            <Input
              aria-label={`Data da parcela ${index + 1}`}
              type="date"
              className="h-11"
              value={row.dueDate}
              onChange={(event) => {
                const dueDate = event.target.value;
                // Mudar a 1ª data reposiciona as demais (mês a mês), mantendo os valores.
                if (index === 0 && rows.length > 1 && dueDate) {
                  const dates = suggestInstallments(0, rows.length, dueDate).map((draft) => draft.dueDate);
                  onChange(rows.map((current, position) => ({ ...current, dueDate: dates[position] ?? current.dueDate })));
                } else update(index, { dueDate });
              }}
            />
            <Input
              aria-label={`Valor da parcela ${index + 1}`}
              inputMode="decimal"
              className="h-11 text-right tabular-nums"
              value={row.amount}
              onChange={(event) => update(index, { amount: event.target.value })}
            />
          </li>
        ))}
      </ol>

      <p className={cn("rounded-md border px-3 py-2 text-[13px] tabular-nums", check.differenceCents === 0 ? "border-border text-muted-foreground" : "border-[color:var(--status-alert)] text-foreground")} aria-live="polite" data-sensitive>
        Soma {formatCents(check.sumCents)} de {formatCents(totalCents)}
        {check.differenceCents > 0 ? ` · faltam ${formatCents(check.differenceCents)}` : null}
        {check.differenceCents < 0 ? ` · passou ${formatCents(-check.differenceCents)}` : null}
        {check.differenceCents === 0 ? " · confere" : null}
      </p>
    </div>
  );
}
