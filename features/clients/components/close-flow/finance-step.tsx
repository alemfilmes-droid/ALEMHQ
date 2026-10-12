"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { toCents } from "@/features/finance/money";
import { financePlan, type ManualEntry } from "@/lib/clients/lifecycle";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FinanceRow {
  id: string;
  description: string;
  due_date: string;
  project: string | null;
  amount: number | null;
  overdue: boolean;
  payee?: string | null;
  scheduled?: boolean;
}

export interface FinanceAnswer {
  answer: "sim" | "nao" | "";
  keptIds: string[];
  manual: ManualEntry[];
  /** "Não" com lançamentos em aberto: a pessoa confirmou que todos serão cancelados. */
  confirmedCancel: boolean;
}

export const EMPTY_ANSWER: FinanceAnswer = { answer: "", keptIds: [], manual: [], confirmedCancel: false };

interface FinanceStepProps {
  kind: "receivable" | "payable";
  rows: FinanceRow[];
  financeVisible: boolean;
  value: FinanceAnswer;
  onChange: (value: FinanceAnswer) => void;
}

const COPY = {
  receivable: { question: "O cliente ainda precisa pagar algo?", noun: "recebimento", nouns: "recebimentos", add: "Adicionar recebimento" },
  payable: { question: "Existem custos deste cliente a pagar?", noun: "custo", nouns: "custos", add: "Adicionar custo" },
};

function EntryLine({ row, financeVisible }: { row: FinanceRow; financeVisible: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="font-semibold">{row.description}</span>
      <span className="text-muted-foreground">
        {" "}
        · vence {formatDate(row.due_date)}
        {row.project ? ` · ${row.project}` : ""}
        {row.payee ? ` · ${row.payee}` : ""}
        {row.overdue ? " · vencido" : ""}
        {row.scheduled ? " · agendado" : ""}
      </span>
      {financeVisible && row.amount != null ? (
        <span className="text-muted-foreground">
          {" "}
          · <Money cents={toCents(row.amount)} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * Um lado do financeiro no encerramento. "Sim": a pessoa marca o que continua valendo (o resto em
 * aberto é cancelado) e pode lançar itens manuais, que vão para o Financeiro. "Não": lista o que será
 * cancelado e pede confirmação explícita. Pagos/recebidos nunca aparecem (não mudam).
 */
export function FinanceStep({ kind, rows, financeVisible, value, onChange }: FinanceStepProps) {
  const copy = COPY[kind];
  const plan = financePlan(rows, value.answer === "sim" ? "sim" : "nao", value.keptIds);
  const set = (patch: Partial<FinanceAnswer>) => onChange({ ...value, ...patch });
  const updateManual = (index: number, patch: Partial<ManualEntry>) =>
    set({ manual: value.manual.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)) });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold">{copy.question}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={copy.question}>
          {(["sim", "nao"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="lg"
              variant="secondary"
              role="radio"
              aria-checked={value.answer === option}
              className={cn(value.answer === option && "border-foreground bg-surface-hover font-bold text-foreground")}
              onClick={() => set({ answer: option, confirmedCancel: false })}
            >
              {option === "sim" ? "Sim" : "Não"}
            </Button>
          ))}
        </div>
      </div>

      {value.answer === "sim" ? (
        <>
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              Marque os {copy.nouns} em aberto que continuam valendo. Os não marcados serão cancelados (não são apagados).
            </p>
            {rows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nenhum {copy.noun} em aberto lançado para este cliente.</p>
            ) : (
              <ul className="space-y-1 rounded-md border border-border p-2">
                {rows.map((row) => (
                  <li key={row.id}>
                    <label className="flex min-h-11 items-start gap-3 py-1 text-[13px]">
                      <Checkbox
                        className="mt-0.5 size-5"
                        checked={value.keptIds.includes(row.id)}
                        onCheckedChange={() =>
                          set({ keptIds: value.keptIds.includes(row.id) ? value.keptIds.filter((id) => id !== row.id) : [...value.keptIds, row.id] })
                        }
                      />
                      <EntryLine row={row} financeVisible={financeVisible} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            {value.manual.map((entry, index) => (
              <fieldset key={index} className="grid gap-3 rounded-md border border-border-strong p-3 sm:grid-cols-2">
                <legend className="eyebrow px-1">Novo {copy.noun} {index + 1}</legend>
                <FormField id={`${kind}-manual-desc-${index}`} label="Descrição" className="sm:col-span-2">
                  <Input id={`${kind}-manual-desc-${index}`} value={entry.description} onChange={(event) => updateManual(index, { description: event.target.value })} />
                </FormField>
                <FormField id={`${kind}-manual-amount-${index}`} label="Valor (R$)">
                  <Input id={`${kind}-manual-amount-${index}`} inputMode="decimal" placeholder="0,00" value={entry.amount} onChange={(event) => updateManual(index, { amount: event.target.value })} />
                </FormField>
                <FormField id={`${kind}-manual-due-${index}`} label="Vencimento">
                  <Input id={`${kind}-manual-due-${index}`} type="date" value={entry.dueDate} onChange={(event) => updateManual(index, { dueDate: event.target.value })} />
                </FormField>
                {kind === "payable" ? (
                  <FormField id={`${kind}-manual-payee-${index}`} label="Favorecido" className="sm:col-span-2">
                    <Input id={`${kind}-manual-payee-${index}`} value={entry.payeeName ?? ""} onChange={(event) => updateManual(index, { payeeName: event.target.value })} />
                  </FormField>
                ) : null}
                <Button type="button" variant="ghost" size="lg" className="sm:col-span-2 sm:justify-self-start" onClick={() => set({ manual: value.manual.filter((_, position) => position !== index) })}>
                  <Trash2 aria-hidden />
                  Remover
                </Button>
              </fieldset>
            ))}
            <Button type="button" variant="secondary" size="lg" onClick={() => set({ manual: [...value.manual, { description: "", amount: "", dueDate: "", payeeName: "" }] })}>
              <Plus aria-hidden />
              {copy.add}
            </Button>
            <p className="text-[12px] text-muted-foreground">Os {copy.nouns} adicionados aqui são criados no Financeiro ao confirmar.</p>
          </div>
        </>
      ) : null}

      {value.answer === "nao" && plan.cancelled.length > 0 ? (
        <div className="space-y-2 rounded-md border-2 border-foreground p-3">
          <p className="text-sm font-semibold">Serão cancelados ({plan.cancelled.length}):</p>
          <ul className="space-y-1 text-[13px]">
            {rows.map((row) => (
              <li key={row.id} className="flex">
                <EntryLine row={row} financeVisible={financeVisible} />
              </li>
            ))}
          </ul>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <Checkbox className="size-5" checked={value.confirmedCancel} onCheckedChange={(checked) => set({ confirmedCancel: checked === true })} />
            Confirmo: cancelar esses {copy.nouns} (eles continuam no histórico como cancelados)
          </label>
        </div>
      ) : null}
      {value.answer === "nao" && plan.cancelled.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhum {copy.noun} em aberto: nada será cancelado.</p>
      ) : null}
    </div>
  );
}

/** O passo está respondido? ("Não" com itens em aberto exige a confirmação explícita.) */
export function financeStepDone(value: FinanceAnswer, rows: FinanceRow[]): boolean {
  if (value.answer === "") return false;
  if (value.answer === "nao") return rows.length === 0 || value.confirmedCancel;
  return true;
}
