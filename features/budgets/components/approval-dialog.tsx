"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarClock, CheckCircle2, FolderKanban, Link2, Plus, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { approveBudgetAction, getApprovalContextAction, getApprovalProjectsAction, type ApprovalContext } from "@/features/budgets/approval-actions";
import { SegmentField } from "@/components/companies/segment-field";
import { ActionError } from "@/components/ui/action-error";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { draftsFromRows, InstallmentsEditor, suggestedRows, type InstallmentRow } from "@/features/finance/components/installments-editor";
import { MethodSelect } from "@/features/finance/components/method-select";
import { approvalInputSchema, approvalPreview, budgetMarginWarning, checkInstallments, NEW_PROJECT_STAGES, type ApprovalInput, type NewProjectStage } from "@/lib/budgets/approval";
import { addDays, todayInAppZone } from "@/lib/calendar";
import { COMPANY_SOURCES, MODEL_LABELS, MODELS, SOURCE_LABELS, STAGE_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CompanySource, PaymentMethod, ProjectModel } from "@/types";

const STEPS = [
  { key: "cliente", label: "Cliente", icon: Building2 },
  { key: "projeto", label: "Projeto", icon: FolderKanban },
  { key: "pagamento", label: "Pagamento", icon: Wallet },
  { key: "revisar", label: "Revisar", icon: CheckCircle2 },
] as const;


/** Cartão de escolha (rádio grande, bom de tocar no celular). */
function Choice({ selected, onSelect, icon: Icon, title, hint, disabled }: { selected: boolean; onSelect: () => void; icon: typeof Building2; title: string; hint: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-foreground bg-surface-raised" : "border-border hover:border-border-strong",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

interface Props {
  budgetId: string;
  companies: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Aprovar orçamento → recebimentos, em 4 passos: cliente, projeto (e pautas iniciais), pagamento (datas agora ou
 * delegar ao financeiro) e revisão. Nada é gravado até "Aprovar e criar"; aí tudo acontece numa transação só.
 */
export function ApprovalDialog({ budgetId, companies, open, onOpenChange }: Props) {
  const router = useRouter();
  const [context, setContext] = useState<ApprovalContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Cliente
  const [companyMode, setCompanyMode] = useState<"existing" | "new">("existing");
  const [companyId, setCompanyId] = useState("");
  const [newCompany, setNewCompany] = useState({ name: "", document: "", segment: "", source: "" as CompanySource | "" });
  // Projeto
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectMode, setProjectMode] = useState<"existing" | "new">("new");
  const [projectId, setProjectId] = useState("");
  const [newProject, setNewProject] = useState({ name: "", model: "transacional" as ProjectModel, stage: "planejamento" as NewProjectStage, date: "" });
  const [pautaItemIds, setPautaItemIds] = useState<string[]>([]);
  // Pagamento
  const [paymentMode, setPaymentMode] = useState<"schedule" | "delegate">("schedule");
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setContext(null);
    setLoadError(null);
    setStep(0);
    setError(null);
    void getApprovalContextAction(budgetId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const { budget, projects: clientProjects, financePeople } = result.context;
      setContext(result.context);
      // Pré-preenche o que o orçamento já sabe (cliente/projeto ligados confirmam sozinhos).
      setCompanyMode(budget.companyId ? "existing" : "new");
      setCompanyId(budget.companyId ?? "");
      setNewCompany({ name: budget.clientName, document: "", segment: "", source: "" });
      setProjects(clientProjects);
      const linkedProject = clientProjects.some((project) => project.id === budget.projectId) ? budget.projectId : null;
      setProjectMode(linkedProject ? "existing" : "new");
      setProjectId(linkedProject ?? "");
      setNewProject({ name: budget.title, model: "transacional", stage: "planejamento", date: addDays(todayInAppZone(), 30) });
      setPautaItemIds([]);
      setPaymentMode("schedule");
      setRows(suggestedRows(budget.totalCents, 1, addDays(todayInAppZone(), 7)));
      setMethod("");
      setAssigneeId(financePeople[0]?.id ?? "");
      setNote("");
    });
    return () => {
      cancelled = true;
    };
  }, [open, budgetId]);

  function chooseCompany(id: string) {
    setCompanyId(id);
    setProjectId("");
    setProjects([]);
    setProjectMode("new");
    if (id) void getApprovalProjectsAction(id).then(setProjects);
  }

  const input: ApprovalInput | null = useMemo(() => {
    if (!context) return null;
    return {
      note,
      company: companyMode === "existing" ? { mode: "existing", id: companyId } : { mode: "new", name: newCompany.name, document: newCompany.document, segment: newCompany.segment, source: newCompany.source || null },
      project: projectMode === "existing" && companyMode === "existing" ? { mode: "existing", id: projectId } : { mode: "new", name: newProject.name, model: newProject.model, stage: newProject.stage, date: newProject.date },
      pautaItemIds,
      payment: paymentMode === "schedule" ? { mode: "schedule", method: method || null, installments: draftsFromRows(rows) } : { mode: "delegate", assigneeId },
    };
  }, [context, note, companyMode, companyId, newCompany, projectMode, projectId, newProject, pautaItemIds, paymentMode, method, rows, assigneeId]);

  if (!open) return null;

  const budget = context?.budget;
  const fromDeal = Boolean(budget?.dealCompanyId);
  const marginWarning = context ? budgetMarginWarning(context.budget.marginPct, context.thresholds) : null;
  const installmentCheck = budget ? checkInstallments(budget.totalCents, draftsFromRows(rows)) : null;

  const stepError = (() => {
    if (!context) return "Carregando…";
    if (step === 0) {
      if (companyMode === "existing" && !companyId) return "Escolha o cliente.";
      if (companyMode === "new" && newCompany.name.trim().length < 2) return "Informe o nome do cliente.";
    }
    if (step === 1) {
      if (projectMode === "existing" && companyMode === "existing" && !projectId) return "Escolha o projeto.";
      if ((projectMode === "new" || companyMode === "new") && newProject.name.trim().length < 2) return "Informe o nome do projeto.";
      if ((projectMode === "new" || companyMode === "new") && !newProject.date) return newProject.model === "recorrente" ? "Informe o início do projeto." : "Informe o prazo de entrega.";
    }
    if (step === 2) {
      if (paymentMode === "schedule" && installmentCheck && !installmentCheck.ok) return installmentCheck.errors[0] ?? "Revise as parcelas.";
      if (paymentMode === "delegate" && !assigneeId) return "Escolha quem do financeiro define a data.";
    }
    return null;
  })();

  const parsed = input ? approvalInputSchema.safeParse(input) : null;
  const preview =
    context && parsed?.success
      ? approvalPreview(parsed.data, {
          totalCents: context.budget.totalCents,
          dealCompanyId: context.budget.dealCompanyId,
          itemIds: context.items.map((item) => item.id),
          number: context.budget.number,
          label: context.budget.label,
          items: context.items,
          companyName: companies.find((company) => company.id === companyId)?.name,
          projectName: projects.find((project) => project.id === projectId)?.name,
          hasDeal: Boolean(context.budget.dealId),
        })
      : null;

  function confirm() {
    if (!input) return;
    setError(null);
    startTransition(async () => {
      const result = await approveBudgetAction(budgetId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  const current = STEPS[step] ?? STEPS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[100dvh] w-full max-w-xl flex-col gap-4 max-sm:inset-0 max-sm:h-[100dvh] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:p-4 max-sm:left-0 max-sm:top-0">
        <DialogHeader>
          <p className="eyebrow">
            Passo {step + 1} de {STEPS.length} · {current.label}
          </p>
          <DialogTitle>Aprovar orçamento.</DialogTitle>
          <DialogDescription>
            {budget ? (
              <>
                {budget.label} · {budget.title} · <Money cents={budget.totalCents} />
              </>
            ) : (
              "Carregando o orçamento…"
            )}
          </DialogDescription>
          <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Passos">
            {STEPS.map((item, index) => (
              <li key={item.key} className={cn("h-1.5 rounded-full", index <= step ? "bg-foreground" : "bg-border")} aria-current={index === step ? "step" : undefined}>
                <span className="sr-only">{item.label}</span>
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {loadError ? <ActionError message={loadError} /> : null}
          {!context && !loadError ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}

          {/* Aviso de margem: só aqui, só informativo. */}
          {marginWarning ? (
            <Alert title="Margem abaixo de 30%">
              <span className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--status-alert)" }} aria-hidden />
                <span data-sensitive>{marginWarning}</span>
              </span>
            </Alert>
          ) : null}

          {context && step === 0 ? (
            <div className="space-y-3" role="radiogroup" aria-label="Cliente">
              {fromDeal ? (
                <Alert title="Cliente do negócio no CRM">
                  {companies.find((company) => company.id === companyId)?.name ?? context.budget.clientName}
                  {context.budget.dealTitle ? ` · ${context.budget.dealTitle}` : ""}. Ligado automaticamente; o negócio será marcado como ganho.
                </Alert>
              ) : (
                <>
                  <Choice selected={companyMode === "existing"} onSelect={() => setCompanyMode("existing")} icon={Link2} title="Cliente cadastrado" hint={context.budget.companyId ? "Já ligado a este orçamento — confirme." : "Escolha na lista."} />
                  {companyMode === "existing" ? (
                    <FormField id="approval-company" label="Cliente">
                      <SearchSelect id="approval-company" value={companyId} onChange={chooseCompany} placeholder="Buscar cliente" options={companies.map((company) => ({ value: company.id, label: company.name }))} />
                    </FormField>
                  ) : null}
                  <Choice selected={companyMode === "new"} onSelect={() => setCompanyMode("new")} icon={Plus} title="Cadastrar cliente novo" hint="Nome, CNPJ (opcional), segmento e origem." />
                  {companyMode === "new" ? (
                    <div className="space-y-3 rounded-lg border border-border p-3">
                      <FormField id="approval-company-name" label="Nome do cliente">
                        <Input id="approval-company-name" className="h-11" maxLength={160} value={newCompany.name} onChange={(event) => setNewCompany({ ...newCompany, name: event.target.value })} />
                      </FormField>
                      <FormField id="approval-company-document" label="CNPJ (opcional)">
                        <Input id="approval-company-document" className="h-11" inputMode="numeric" maxLength={32} value={newCompany.document} onChange={(event) => setNewCompany({ ...newCompany, document: event.target.value })} />
                      </FormField>
                      <SegmentField value={newCompany.segment} onChange={(segment) => setNewCompany((previous) => ({ ...previous, segment }))} />
                      <FormField id="approval-company-source" label="Origem">
                        <NativeSelect id="approval-company-source" className="h-11" value={newCompany.source} onChange={(event) => setNewCompany({ ...newCompany, source: event.target.value as CompanySource | "" })}>
                          <option value="">Não informada</option>
                          {COMPANY_SOURCES.map((source) => (
                            <option key={source} value={source}>
                              {SOURCE_LABELS[source]}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormField>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {context && step === 1 ? (
            <div className="space-y-3" role="radiogroup" aria-label="Projeto">
              {companyMode === "existing" ? (
                <Choice
                  selected={projectMode === "existing"}
                  onSelect={() => setProjectMode("existing")}
                  disabled={projects.length === 0}
                  icon={Link2}
                  title="Projeto existente"
                  hint={projects.length === 0 ? "Este cliente ainda não tem projeto." : context.budget.projectId === projectId && projectId ? "Já ligado a este orçamento — confirme." : "Escolha na lista."}
                />
              ) : null}
              {projectMode === "existing" && companyMode === "existing" ? (
                <FormField id="approval-project" label="Projeto">
                  <SearchSelect id="approval-project" value={projectId} onChange={setProjectId} placeholder="Buscar projeto" options={projects.map((project) => ({ value: project.id, label: project.name }))} />
                </FormField>
              ) : null}
              <Choice selected={projectMode === "new" || companyMode === "new"} onSelect={() => setProjectMode("new")} icon={Plus} title="Criar projeto" hint="Nome, modelo e etapa." />
              {projectMode === "new" || companyMode === "new" ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <FormField id="approval-project-name" label="Nome do projeto">
                    <Input id="approval-project-name" className="h-11" maxLength={160} value={newProject.name} onChange={(event) => setNewProject({ ...newProject, name: event.target.value })} />
                  </FormField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField id="approval-project-model" label="Modelo">
                      <NativeSelect
                        id="approval-project-model"
                        className="h-11"
                        value={newProject.model}
                        onChange={(event) => {
                          const model = event.target.value as ProjectModel;
                          // Transacional pede o prazo de entrega; Recorrente, o início do contrato.
                          setNewProject({ ...newProject, model, date: model === "recorrente" ? todayInAppZone() : addDays(todayInAppZone(), 30) });
                        }}
                      >
                        {MODELS.map((model) => (
                          <option key={model} value={model}>
                            {MODEL_LABELS[model]}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField id="approval-project-stage" label="Etapa">
                      <NativeSelect id="approval-project-stage" className="h-11" value={newProject.stage} onChange={(event) => setNewProject({ ...newProject, stage: event.target.value as NewProjectStage })}>
                        {NEW_PROJECT_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {STAGE_LABELS[stage]}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                  </div>
                  <FormField id="approval-project-date" label={newProject.model === "recorrente" ? "Início do contrato" : "Prazo de entrega"}>
                    <Input id="approval-project-date" type="date" className="h-11" value={newProject.date} onChange={(event) => setNewProject({ ...newProject, date: event.target.value })} />
                  </FormField>
                </div>
              ) : null}

              {context.items.length > 0 ? (
                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-semibold">Pautas iniciais (opcional)</legend>
                  <p className="text-[13px] text-muted-foreground">Cada item marcado vira uma pauta no projeto, só com o nome. Os custos do orçamento não vão para o projeto: os custos reais você lança no projeto.</p>
                  <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {context.items.map((item) => {
                      const checked = pautaItemIds.includes(item.id);
                      return (
                        <li key={item.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-surface-raised">
                            <Checkbox checked={checked} onCheckedChange={(next) => setPautaItemIds((ids) => (next ? [...ids, item.id] : ids.filter((id) => id !== item.id)))} />
                            <span className="text-sm">{item.description}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {context && budget && step === 2 ? (
            <div className="space-y-3" role="radiogroup" aria-label="Pagamento">
              {budget.paymentTerms ? <p className="text-[13px] text-muted-foreground">Condições do orçamento: {budget.paymentTerms}</p> : null}
              <Choice selected={paymentMode === "schedule"} onSelect={() => setPaymentMode("schedule")} icon={CalendarClock} title="Definir as datas agora" hint="Uma data ou parcelas que somam o total." />
              {paymentMode === "schedule" ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <InstallmentsEditor idPrefix="approval" totalCents={budget.totalCents} rows={rows} onChange={setRows} />
                  <FormField id="approval-method" label="Forma de pagamento">
                    <MethodSelect id="approval-method" value={method} onChange={setMethod} optional />
                  </FormField>
                </div>
              ) : null}
              <Choice
                selected={paymentMode === "delegate"}
                onSelect={() => setPaymentMode("delegate")}
                disabled={context.financePeople.length === 0}
                icon={UserRound}
                title="Delegar ao financeiro"
                hint={context.financePeople.length === 0 ? "Ninguém ativo no squad Financeiro." : "Vira a pauta “Definir data de pagamento” com notificação; o recebimento fica “Data a definir”."}
              />
              {paymentMode === "delegate" ? (
                <FormField id="approval-assignee" label="Quem define a data">
                  <NativeSelect id="approval-assignee" className="h-11" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                    {context.financePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              ) : null}
            </div>
          ) : null}

          {context && step === 3 ? (
            <div className="space-y-4">
              {preview ? (
                <ul className="space-y-3 text-sm">
                  <li className="flex flex-wrap items-center gap-2">
                    <Building2 className="size-4" aria-hidden />
                    <span className="font-semibold">{preview.company.label}</span>
                    <Badge variant="outline">{preview.company.action === "create" ? "cliente novo" : "cliente ligado"}</Badge>
                  </li>
                  <li className="flex flex-wrap items-center gap-2">
                    <FolderKanban className="size-4" aria-hidden />
                    <span className="font-semibold">{preview.project.label}</span>
                    <Badge variant="outline">{preview.project.action === "create" ? "projeto novo" : "projeto ligado"}</Badge>
                  </li>
                  <li>
                    <p className="flex items-center gap-2 font-semibold">
                      <Wallet className="size-4" aria-hidden />
                      Recebimentos no Financeiro
                    </p>
                    <ul className="mt-1 space-y-1 pl-6">
                      {preview.receivables.map((item, index) => (
                        <li key={index} className="flex justify-between gap-3 tabular-nums">
                          <span className="text-muted-foreground">{item.dueDate ? formatDate(item.dueDate) : "Data a definir"}</span>
                          <Money cents={item.amountCents} />
                        </li>
                      ))}
                    </ul>
                  </li>
                  {preview.pautas.length > 0 ? (
                    <li>
                      <p className="font-semibold">Pautas</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-6 text-muted-foreground">
                        {preview.pautas.map((pauta, index) => (
                          <li key={index}>
                            {pauta.title}
                            {pauta.kind === "definir_data" ? ` — ${context.financePeople.find((person) => person.id === pauta.assigneeId)?.name ?? ""}` : ""}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null}
                  {preview.dealWon ? <li className="text-muted-foreground">O negócio no CRM é marcado como ganho e o vínculo fica guardado.</li> : null}
                  <li className="text-muted-foreground">Nenhum custo do orçamento é copiado para o projeto.</li>
                </ul>
              ) : (
                <ActionError message={parsed && !parsed.success ? (parsed.error.issues[0]?.message ?? "Revise os passos.") : null} />
              )}
              <FormField id="approval-note" label="Observação (opcional)">
                <Textarea id="approval-note" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
              </FormField>
            </div>
          ) : null}

          <ActionError message={error} />
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          {step > 0 ? (
            <Button type="button" variant="secondary" className="h-11" onClick={() => setStep(step - 1)} disabled={pending}>
              <ArrowLeft aria-hidden />
              Voltar
            </Button>
          ) : (
            <Button type="button" variant="secondary" className="h-11" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button type="button" className="h-11" onClick={() => setStep(step + 1)} disabled={Boolean(stepError)} title={stepError ?? undefined}>
              Continuar
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button type="button" className="h-11" onClick={confirm} loading={pending} disabled={!preview}>
              <CheckCircle2 aria-hidden />
              Aprovar e criar
            </Button>
          )}
        </div>
        {stepError && context && step < STEPS.length - 1 ? <p className="-mt-2 text-right text-[12px] text-muted-foreground">{stepError}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
