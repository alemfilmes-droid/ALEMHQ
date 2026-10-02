"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileText, Presentation, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBudgetAction, duplicateBudgetAction, saveBudgetAction, type BudgetHeaderValues } from "@/features/budgets/actions";
import { PresentationDialog } from "@/features/budgets/components/presentation-dialog";
import { brl, computeBudget, pct, SECTION_LABELS, type BudgetLineInput, type BudgetSection } from "@/features/budgets/pricing";
import { BUDGET_STATUS_LABELS, type BudgetRecord, type BudgetStatus, type CatalogItem } from "@/features/budgets/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FREE_ITEM = "__livre__";
const NO_COMPANY = "__sem_cadastro__";

/** "1.234,56" ou "1234.56" → 1234.56 */
function parseNumber(value: string): number {
  const clean = value.trim().replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Row = BudgetLineInput & { catalogItemId: string | null };

/** Campo de número que aceita vírgula e só reformata ao sair. */
function NumberCell({ value, onChange, label, className, allowEmpty = false }: { value: number | null; onChange: (value: number | null) => void; label: string; className?: string; allowEmpty?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={draft ?? (value === null ? "" : formatInput(value))}
      placeholder={allowEmpty ? "auto" : undefined}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => {
        if (draft !== null) onChange(allowEmpty && draft.trim() === "" ? null : parseNumber(draft));
        setDraft(null);
      }}
      className={cn("h-8 px-2 text-right tabular-nums", className)}
    />
  );
}

interface BudgetEditorProps {
  budget: BudgetRecord;
  catalog: CatalogItem[];
  companies: { id: string; name: string; logo_url: string | null }[];
}

/**
 * Orçamento como planilha: à esquerda o que o cliente vê (item, quantidade, valor), à direita os
 * valores reais (custo, imposto, ganho e margem por linha). O FEE da empresa e o imposto, definidos
 * aqui, recalculam o valor final para o cliente.
 */
export function BudgetEditor({ budget, catalog, companies }: BudgetEditorProps) {
  const router = useRouter();
  const [header, setHeader] = useState<BudgetHeaderValues>({
    clientName: budget.clientName,
    companyId: budget.companyId ?? "",
    title: budget.title,
    issueDate: budget.issueDate,
    validUntil: budget.validUntil,
    feePct: budget.feePct,
    taxPct: budget.taxPct,
    status: budget.status,
    paymentTerms: budget.paymentTerms,
    notes: budget.notes,
  });
  const [rows, setRows] = useState<Row[]>(budget.items.map((item) => ({ ...item, catalogItemId: null })));
  const [dirty, setDirty] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  const { lines, totals } = useMemo(() => computeBudget(rows, header.feePct, header.taxPct), [rows, header.feePct, header.taxPct]);
  const lineById = new Map(lines.map((line) => [line.id, line]));

  function setField<K extends keyof BudgetHeaderValues>(key: K, value: BudgetHeaderValues[K]) {
    setHeader((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setDirty(true);
  }

  function addRow(section: BudgetSection, catalogId: string) {
    const item = catalog.find((entry) => entry.id === catalogId);
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        section,
        catalogItemId: item?.id ?? null,
        description: item?.name ?? "",
        unit: item?.unit ?? (section === "profissional" ? "diária" : "unidade"),
        quantity: 1,
        unitCost: item?.defaultCost ?? 0,
        unitPriceOverride: null,
      },
    ]);
    setDirty(true);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    setDirty(true);
  }

  async function persist(): Promise<boolean> {
    const invalid = rows.find((row) => !row.description.trim());
    if (invalid) {
      toast.error("Há um item sem descrição.");
      return false;
    }
    const result = await saveBudgetAction(
      budget.id,
      header,
      rows.map((row) => ({
        section: row.section,
        catalogItemId: row.catalogItemId,
        description: row.description.trim(),
        unit: row.unit,
        quantity: row.quantity > 0 ? row.quantity : 1,
        unitCost: row.unitCost,
        unitPriceOverride: row.unitPriceOverride,
      })),
    );
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setDirty(false);
    return true;
  }

  function save() {
    startSaving(async () => {
      if (await persist()) {
        toast.success("Orçamento salvo.");
        router.refresh();
      }
    });
  }

  function openDocument(path: "nota" | "apresentacao") {
    startSaving(async () => {
      if (dirty && !(await persist())) return;
      window.open(`/orcamentos/${budget.id}/${path}`, "_blank", "noopener");
    });
  }

  function duplicate() {
    startSaving(async () => {
      const result = await duplicateBudgetAction(budget.id);
      if (!result.ok) toast.error(result.error);
      else if (result.id) router.push(`/orcamentos/${result.id}`);
    });
  }

  function remove() {
    if (!window.confirm("Apagar este orçamento? Não dá para desfazer.")) return;
    startSaving(async () => {
      const result = await deleteBudgetAction(budget.id);
      if (result.ok) router.push("/orcamentos");
      else toast.error(result.error);
    });
  }

  const sections: BudgetSection[] = ["profissional", "custo"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} loading={saving} disabled={!dirty}>
          <Save aria-hidden />
          {dirty ? "Salvar" : "Salvo"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => openDocument("nota")} disabled={saving || rows.length === 0}>
          <FileText aria-hidden />
          Nota de orçamento (PDF)
        </Button>
        <Button type="button" variant="secondary" onClick={() => setPresentationOpen(true)} disabled={saving || rows.length === 0}>
          <Presentation aria-hidden />
          Apresentação comercial
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={duplicate} disabled={saving}>
            <Copy aria-hidden />
            Duplicar
          </Button>
          <Button type="button" variant="ghost" onClick={remove} disabled={saving}>
            <Trash2 aria-hidden />
            Apagar
          </Button>
        </div>
      </div>

      <Card variant="static">
        <CardContent className="grid gap-5 p-6 md:grid-cols-6">
          <FormField id="budget-company" label="Cliente cadastrado" className="md:col-span-2">
            <SearchSelect
              id="budget-company"
              value={header.companyId || NO_COMPANY}
              onChange={(value) => {
                const company = companies.find((item) => item.id === value);
                setField("companyId", value === NO_COMPANY ? "" : value);
                if (company) setField("clientName", company.name);
              }}
              options={[{ value: NO_COMPANY, label: "Sem cadastro (digite o nome)" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]}
              placeholder="Selecione"
            />
          </FormField>
          <FormField id="budget-client" label="Nome do cliente no orçamento" className="md:col-span-2">
            <Input id="budget-client" value={header.clientName} onChange={(event) => setField("clientName", event.target.value)} />
          </FormField>
          <FormField id="budget-title" label="Projeto" className="md:col-span-2">
            <Input id="budget-title" value={header.title} onChange={(event) => setField("title", event.target.value)} />
          </FormField>
          <FormField id="budget-issue" label="Data do orçamento" className="md:col-span-2">
            <Input
              id="budget-issue"
              type="date"
              value={header.issueDate}
              onChange={(event) => {
                setField("issueDate", event.target.value);
                if (event.target.value) setField("validUntil", addDays(event.target.value, 30));
              }}
            />
          </FormField>
          <FormField id="budget-valid" label="Válido até" hint="30 dias por padrão." className="md:col-span-2">
            <Input id="budget-valid" type="date" value={header.validUntil} onChange={(event) => setField("validUntil", event.target.value)} />
          </FormField>
          <FormField id="budget-status" label="Situação" className="md:col-span-2">
            <Select value={header.status} onValueChange={(value) => setField("status", value as BudgetStatus)}>
              <SelectTrigger id="budget-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BUDGET_STATUS_LABELS) as BudgetStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {BUDGET_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="text-[12px] text-subtle">
              <th colSpan={5} className="border-b border-border px-3 py-2 text-left font-bold text-foreground">
                Para o cliente
              </th>
              <th colSpan={6} className="border-b border-l-2 border-border border-l-brand-accent/50 bg-surface-raised px-3 py-2 text-left font-bold text-foreground">
                Valores reais e margens <span className="font-normal text-subtle">· só você vê</span>
              </th>
            </tr>
            <tr className="text-left text-[12px] text-subtle">
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="w-20 px-2 py-2 text-right font-semibold">Qtd</th>
              <th className="w-28 px-2 py-2 font-semibold">Unidade</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">Valor unit.</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Total</th>
              <th className="w-32 border-l-2 border-l-brand-accent/50 bg-surface-raised px-2 py-2 text-right font-semibold">Custo unit.</th>
              <th className="w-28 bg-surface-raised px-2 py-2 text-right font-semibold">Custo total</th>
              <th className="w-24 bg-surface-raised px-2 py-2 text-right font-semibold">Imposto</th>
              <th className="w-28 bg-surface-raised px-2 py-2 text-right font-semibold">Ganho</th>
              <th className="w-20 bg-surface-raised px-2 py-2 text-right font-semibold">Margem</th>
              <th className="w-10 bg-surface-raised" />
            </tr>
          </thead>
          {sections.map((section) => {
            const sectionRows = rows.filter((row) => row.section === section);
            const options = catalog.filter((item) => item.section === section && item.active);
            return (
              <tbody key={section}>
                <tr>
                  <td colSpan={5} className="border-t border-border px-3 pb-1 pt-4 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                    {SECTION_LABELS[section]}
                  </td>
                  <td colSpan={6} className="border-l-2 border-t border-border border-l-brand-accent/50 bg-surface-raised" />
                </tr>
                {sectionRows.map((row) => {
                  const line = lineById.get(row.id);
                  return (
                    <tr key={row.id} className="align-middle">
                      <td className="px-3 py-1">
                        <Input aria-label="Item" value={row.description} onChange={(event) => updateRow(row.id, { description: event.target.value })} className="h-8" />
                      </td>
                      <td className="px-2 py-1">
                        <NumberCell label="Quantidade" value={row.quantity} onChange={(value) => updateRow(row.id, { quantity: value ?? 1 })} />
                      </td>
                      <td className="px-2 py-1">
                        <Input aria-label="Unidade" value={row.unit} onChange={(event) => updateRow(row.id, { unit: event.target.value })} className="h-8 px-2" />
                      </td>
                      <td className="px-2 py-1">
                        <NumberCell
                          label="Valor unitário ao cliente"
                          allowEmpty
                          value={row.unitPriceOverride ?? line?.unitPrice ?? 0}
                          onChange={(value) => updateRow(row.id, { unitPriceOverride: value === null || value === line?.unitPrice ? null : value })}
                          className={row.unitPriceOverride !== null ? "border-brand-accent/60" : undefined}
                        />
                      </td>
                      <td className="px-3 py-1 text-right font-semibold tabular-nums">{brl(line?.price ?? 0)}</td>
                      <td className="border-l-2 border-l-brand-accent/50 bg-surface-raised px-2 py-1">
                        <NumberCell label="Custo unitário" value={row.unitCost} onChange={(value) => updateRow(row.id, { unitCost: value ?? 0 })} />
                      </td>
                      <td className="bg-surface-raised px-2 py-1 text-right tabular-nums">{brl(line?.cost ?? 0)}</td>
                      <td className="bg-surface-raised px-2 py-1 text-right tabular-nums text-muted-foreground">{brl(line?.tax ?? 0)}</td>
                      <td className="bg-surface-raised px-2 py-1 text-right font-semibold tabular-nums">{brl(line?.profit ?? 0)}</td>
                      <td className="bg-surface-raised px-2 py-1 text-right tabular-nums text-muted-foreground">{pct(line?.marginPct ?? 0)}</td>
                      <td className="bg-surface-raised px-1 py-1">
                        <button type="button" onClick={() => removeRow(row.id)} className="rounded-sm p-1 text-subtle hover:text-foreground" aria-label={`Remover ${row.description}`}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={5} className="px-3 py-2">
                    <div className="max-w-sm">
                      <SearchSelect
                        id={`add-${section}`}
                        value=""
                        onChange={(value) => addRow(section, value === FREE_ITEM ? "" : value)}
                        options={[
                          { value: FREE_ITEM, label: "+ Item livre (digitar)" },
                          ...options.map((item) => ({ value: item.id, label: item.name, hint: `${item.unit}${item.defaultCost ? ` · custo ${brl(item.defaultCost)}` : ""}` })),
                        ]}
                        placeholder={section === "profissional" ? "+ Adicionar profissional ou serviço" : "+ Adicionar custo"}
                      />
                    </div>
                  </td>
                  <td colSpan={6} className="border-l-2 border-l-brand-accent/50 bg-surface-raised" />
                </tr>
              </tbody>
            );
          })}
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={4} className="px-3 py-4 text-right text-sm font-bold">
                Valor final para o cliente
              </td>
              <td className="px-3 py-4 text-right font-display text-xl font-black tabular-nums">{brl(totals.price)}</td>
              <td colSpan={6} className="border-l-2 border-l-brand-accent/50 bg-surface-raised p-4 align-top">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-3">
                  <span className="text-muted-foreground">Valor final</span>
                  <span className="text-right font-bold tabular-nums lg:col-span-2">{brl(totals.price)}</span>
                  <span className="text-muted-foreground">Custo real</span>
                  <span className="text-right tabular-nums lg:col-span-2">{brl(totals.cost)}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    Imposto
                    <NumberCell label="Imposto (%)" value={header.taxPct} onChange={(value) => setField("taxPct", Math.min(value ?? 0, 99))} className="h-7 w-16" />%
                  </span>
                  <span className="text-right tabular-nums lg:col-span-2">{brl(totals.tax)}</span>
                  <span className="flex items-center gap-2 font-bold">
                    FEE da empresa
                    <NumberCell label="FEE da empresa (%)" value={header.feePct} onChange={(value) => setField("feePct", value ?? 0)} className="h-7 w-16" />%
                  </span>
                  <span className="text-right font-display text-lg font-black tabular-nums lg:col-span-2">
                    {brl(totals.profit)} <span className="text-sm font-semibold text-muted-foreground">· margem {pct(totals.marginPct)}</span>
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[12px] text-subtle">
        Valor unitário ao cliente = custo × (1 + FEE) ÷ (1 − imposto). Digitar um valor ao cliente fixa o preço daquela linha (borda vermelha); apague para
        voltar ao cálculo automático.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="budget-terms" label="Condições de pagamento" hint="Aparece na nota e na apresentação.">
          <Textarea id="budget-terms" rows={3} value={header.paymentTerms} onChange={(event) => setField("paymentTerms", event.target.value)} />
        </FormField>
        <FormField id="budget-notes" label="Observações para o cliente" hint="Aparece na nota de orçamento.">
          <Textarea id="budget-notes" rows={3} value={header.notes} onChange={(event) => setField("notes", event.target.value)} />
        </FormField>
      </div>

      {presentationOpen ? (
        <PresentationDialog
          budgetId={budget.id}
          initial={budget.presentation}
          companyLogoUrl={budget.companyLogoUrl}
          open
          onOpenChange={setPresentationOpen}
          beforeOpen={async () => (dirty ? persist() : true)}
        />
      ) : null}
    </div>
  );
}
