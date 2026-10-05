"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, FileText, Plus, Presentation, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createQuickProjectAction } from "@/app/(app)/projetos/actions";
import { archiveBudgetAction, deleteBudgetAction, duplicateBudgetAction, getClientLinksAction, saveBudgetAction, type BudgetHeaderValues } from "@/features/budgets/actions";
import { BudgetStatusPanel } from "@/features/budgets/components/budget-status-panel";
import { applyContractChangeAction, getBudgetContractStatusAction, type ContractStatus } from "@/features/finance/contract-actions";
import { ContractSyncDialog } from "@/features/finance/components/contract-sync-dialog";
import { PresentationDialog } from "@/features/budgets/components/presentation-dialog";
import { brl, computeBudget, pct, pctNumber, SECTION_LABELS, type BudgetLineInput, type BudgetSection } from "@/features/budgets/pricing";
import type { BudgetRecord, CatalogItem, DeliverableItem } from "@/features/budgets/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FREE_ITEM = "__livre__";
const NO_COMPANY = "__sem_cadastro__";
const NO_PROJECT = "__sem_projeto__";
const NEW_PROJECT = "__novo_projeto__";

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
  /** Quem tem acesso ao financeiro decide o efeito do orçamento no contrato do projeto. */
  canConfirmContract: boolean;
}

/**
 * Orçamento como planilha: à esquerda o que o cliente vê (item, quantidade, valor), à direita os
 * valores reais (custo, ganho e margem por linha). O FEE da empresa e o imposto, definidos aqui,
 * formam o valor do serviço, o imposto e o valor final para o cliente.
 */
export function BudgetEditor({ budget, catalog, companies, canConfirmContract }: BudgetEditorProps) {
  const router = useRouter();
  const [header, setHeader] = useState({
    clientName: budget.clientName,
    companyId: budget.companyId ?? "",
    projectId: budget.projectId ?? "",
    title: budget.title,
    issueDate: budget.issueDate,
    validUntil: budget.validUntil,
    feePct: budget.feePct,
    taxPct: budget.taxPct,
    paymentTerms: budget.paymentTerms,
    notes: budget.notes,
    deliveryTerms: budget.deliveryTerms,
  });
  const [deliverables, setDeliverables] = useState<(DeliverableItem & { key: string })[]>(() =>
    budget.deliverables.map((entry) => ({ ...entry, key: crypto.randomUUID() })),
  );
  const [rows, setRows] = useState<Row[]>(budget.items.map((item) => ({ ...item, catalogItemId: null })));
  const [dirty, setDirty] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null);
  const [saving, startSaving] = useTransition();

  const { lines, totals } = useMemo(() => computeBudget(rows, header.feePct, header.taxPct), [rows, header.feePct, header.taxPct]);
  const lineById = new Map(lines.map((line) => [line.id, line]));

  useEffect(() => {
    if (!header.companyId) {
      setProjects([]);
      return;
    }
    void getClientLinksAction(header.companyId).then((links) => setProjects(links.projects));
  }, [header.companyId]);

  function setField<K extends keyof typeof header>(key: K, value: (typeof header)[K]) {
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

  function chooseProject(value: string) {
    if (value !== NEW_PROJECT) {
      setField("projectId", value === NO_PROJECT ? "" : value);
      return;
    }
    const name = window.prompt("Nome do novo projeto para este cliente:", header.title);
    if (!name?.trim()) return;
    startSaving(async () => {
      const result = await createQuickProjectAction({ name: name.trim(), companyId: header.companyId || null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const project = result.project;
      if (!project) return;
      setProjects((current) => [{ id: project.id, name: project.name }, ...current]);
      setField("projectId", project.id);
      toast.success("Projeto criado e vinculado.");
    });
  }

  async function persist(): Promise<boolean> {
    const invalid = rows.findIndex((row) => !row.description.trim());
    if (invalid >= 0) {
      toast.error(`O item da linha ${invalid + 1} está sem descrição.`);
      return false;
    }
    const values: BudgetHeaderValues = {
      ...header,
      companyId: header.companyId || null,
      projectId: header.projectId || null,
      deliverables: deliverables
        .map((entry) => ({ item: entry.item.trim(), deadline: entry.deadline.trim() }))
        .filter((entry) => entry.item),
    };
    const result = await saveBudgetAction(
      budget.id,
      values,
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
    if (canConfirmContract && values.projectId) void syncContract();
    return true;
  }

  /** Orçamento ligado a projeto: sem contrato, define sozinho; contrato diferente, pergunta. */
  async function syncContract() {
    const status = await getBudgetContractStatusAction(budget.id);
    if (!status || status.decision === "nenhuma") return;
    if (status.decision === "definir") {
      const result = await applyContractChangeAction({
        projectId: status.projectId,
        budgetId: budget.id,
        mode: "definicao",
        amount: status.budgetTotal,
        regenerate: false,
        description: "",
        note: "",
      });
      if (result.ok) toast.success(result.message);
      return;
    }
    setContractStatus(status);
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

  function updateDeliverable(key: string, patch: Partial<DeliverableItem>) {
    setDeliverables((current) => current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));
    setDirty(true);
  }

  function toggleArchive() {
    const archiving = !budget.archivedAt;
    if (archiving && !window.confirm("Arquivar este orçamento? Ele sai da lista, mas o número continua reservado (só apagar libera o número).")) return;
    startSaving(async () => {
      const result = await archiveBudgetAction(budget.id, archiving);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
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
      <BudgetStatusPanel budget={budget} total={totals.final} companyId={header.companyId || null} beforeSend={async () => (dirty ? persist() : true)} />

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
          <Button type="button" variant="ghost" onClick={toggleArchive} disabled={saving}>
            {budget.archivedAt ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {budget.archivedAt ? "Desarquivar" : "Arquivar"}
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
                setField("projectId", "");
                if (company) setField("clientName", company.name);
              }}
              options={[{ value: NO_COMPANY, label: "Sem cadastro (digite o nome)" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]}
              placeholder="Selecione"
            />
          </FormField>
          <FormField id="budget-client" label="Nome do cliente no orçamento" className="md:col-span-2">
            <Input id="budget-client" value={header.clientName} onChange={(event) => setField("clientName", event.target.value)} />
          </FormField>
          <FormField id="budget-title" label="Título do orçamento" className="md:col-span-2">
            <Input id="budget-title" value={header.title} onChange={(event) => setField("title", event.target.value)} />
          </FormField>
          <FormField
            id="budget-project"
            label="Projeto vinculado"
            hint={header.projectId ? undefined : "Opcional: um projeto do cliente, ou crie um novo."}
            className="md:col-span-2"
          >
            <SearchSelect
              id="budget-project"
              value={header.projectId || NO_PROJECT}
              onChange={chooseProject}
              options={[
                { value: NO_PROJECT, label: "Sem projeto" },
                ...(header.companyId ? [{ value: NEW_PROJECT, label: "+ Criar novo projeto para este cliente" }] : []),
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
              placeholder="Selecione"
            />
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
          {header.projectId ? (
            <p className="text-[12px] text-subtle md:col-span-6">
              <Link href={`/projetos/${header.projectId}`} className="underline underline-offset-4 hover:text-foreground">
                Abrir o projeto vinculado
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            <tr className="text-[12px] text-subtle">
              <th colSpan={5} className="border-b border-border px-3 py-2 text-left font-bold text-foreground">
                Para o cliente
              </th>
              <th colSpan={5} className="border-b border-l-2 border-border border-l-brand-accent/50 bg-surface-raised px-3 py-2 text-left font-bold text-foreground">
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
                  <td colSpan={5} className="border-l-2 border-t border-border border-l-brand-accent/50 bg-surface-raised" />
                </tr>
                {sectionRows.map((row) => {
                  const line = lineById.get(row.id);
                  return (
                    <tr key={row.id} className="align-middle">
                      <td className="px-3 py-1">
                        <Input aria-label="Item" value={row.description} onChange={(event) => updateRow(row.id, { description: event.target.value })} className="h-8" />
                      </td>
                      <td className="px-2 py-1">
                        <NumberCell label="Quantidade" value={row.quantity} onChange={(value) => updateRow(row.id, { quantity: value && value > 0 ? value : 1 })} />
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
                  <td colSpan={5} className="border-l-2 border-l-brand-accent/50 bg-surface-raised" />
                </tr>
              </tbody>
            );
          })}
          <tfoot>
            <tr className="border-t-2 border-border align-top">
              <td colSpan={5} className="px-3 py-4">
                <dl className="ml-auto max-w-sm space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">Valor do serviço</dt>
                    <dd className="font-semibold tabular-nums">{brl(totals.services)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      Imposto
                      <NumberCell label="Imposto (%)" value={header.taxPct} onChange={(value) => setField("taxPct", Math.min(value ?? 0, 99))} className="h-7 w-16" />%
                    </dt>
                    <dd className="tabular-nums">{brl(totals.tax)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
                    <dt className="font-bold">Valor final para pagamento</dt>
                    <dd className="font-display text-xl font-black tabular-nums">{brl(totals.final)}</dd>
                  </div>
                </dl>
              </td>
              <td colSpan={5} className="border-l-2 border-l-brand-accent/50 bg-surface-raised p-4">
                <dl className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">Custo real</dt>
                    <dd className="tabular-nums">{brl(totals.cost)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">Imposto ({pctNumber(header.taxPct)}, repassado ao cliente)</dt>
                    <dd className="tabular-nums text-muted-foreground">{brl(totals.tax)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                    <dt className="flex items-center gap-2 font-bold">
                      FEE da empresa
                      <NumberCell label="FEE da empresa (%)" value={header.feePct} onChange={(value) => setField("feePct", value ?? 0)} className="h-7 w-16" />%
                    </dt>
                    <dd className="text-right">
                      <span className="font-display text-lg font-black tabular-nums">{brl(totals.profit)}</span>
                      <span className="block text-[12px] text-muted-foreground">margem {pct(totals.marginPct)} sobre o serviço</span>
                    </dd>
                  </div>
                </dl>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[12px] text-subtle">
        Valor unitário ao cliente = custo × (1 + FEE). O imposto entra separado, sobre o valor do serviço. Digitar um valor ao cliente fixa o preço daquela
        linha (borda vermelha); apague para voltar ao cálculo automático.
      </p>

      <Card variant="static">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="section-title">O que o cliente recebe</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada entrega com o prazo dela. Aparece na nota de orçamento e na apresentação.</p>
          </div>
          {deliverables.length > 0 ? (
            <ol className="space-y-2">
              {deliverables.map((entry, index) => (
                <li key={entry.key} className="grid items-center gap-2 sm:grid-cols-[2rem_minmax(0,3fr)_minmax(0,2fr)_2.5rem]">
                  <span className="hidden text-right text-[12px] tabular-nums text-subtle sm:block">{String(index + 1).padStart(2, "0")}</span>
                  <Input
                    aria-label={`Entrega ${index + 1}`}
                    value={entry.item}
                    maxLength={200}
                    placeholder="1 reels de 2 minutos"
                    onChange={(event) => updateDeliverable(entry.key, { item: event.target.value })}
                  />
                  <Input
                    aria-label={`Prazo da entrega ${index + 1}`}
                    value={entry.deadline}
                    maxLength={120}
                    placeholder="7 dias úteis após a captação"
                    onChange={(event) => updateDeliverable(entry.key, { deadline: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover entrega ${index + 1}`}
                    onClick={() => {
                      setDeliverables((current) => current.filter((item) => item.key !== entry.key));
                      setDirty(true);
                    }}
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex flex-wrap items-end gap-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deliverables.length >= 40}
              onClick={() => {
                setDeliverables((current) => [...current, { key: crypto.randomUUID(), item: "", deadline: "" }]);
                setDirty(true);
              }}
            >
              <Plus aria-hidden />
              Adicionar entrega
            </Button>
            <FormField id="budget-delivery-terms" label="Prazo geral de entrega (opcional)" className="min-w-[16rem] flex-1">
              <Input
                id="budget-delivery-terms"
                maxLength={500}
                value={header.deliveryTerms}
                placeholder="Entrega final em até 10 dias úteis após a captação."
                onChange={(event) => setField("deliveryTerms", event.target.value)}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="budget-terms" label="Condições de pagamento" hint="Aparece na nota e na apresentação.">
          <Textarea id="budget-terms" rows={6} value={header.paymentTerms} onChange={(event) => setField("paymentTerms", event.target.value)} />
        </FormField>
        <FormField id="budget-notes" label="Observações para o cliente" hint="Aparece na nota de orçamento.">
          <Textarea id="budget-notes" rows={6} value={header.notes} onChange={(event) => setField("notes", event.target.value)} />
        </FormField>
      </div>

      {contractStatus ? (
        <ContractSyncDialog
          budgetId={budget.id}
          status={contractStatus}
          onDone={() => {
            setContractStatus(null);
            router.refresh();
          }}
        />
      ) : null}

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
