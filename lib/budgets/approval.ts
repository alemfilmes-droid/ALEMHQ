import { z } from "zod";
import { splitInstallments } from "@/features/finance/money";
import { DEFAULT_MARGIN_THRESHOLDS, type MarginThresholds } from "@/lib/margin";

/**
 * Aprovar orçamento → recebimentos. Aqui mora a regra que a tela e a ação do servidor usam (e que os testes
 * conferem); o banco (public.approve_budget) valida de novo e grava tudo numa transação só.
 *
 * Fonte única dos valores: o total vem do orçamento (budget_final_total) e vira recebimento(s) no Financeiro,
 * ligados a cliente, projeto e orçamento. Os itens de custo do orçamento NUNCA vão para o projeto: o pedido
 * leva só os ids dos itens escolhidos para virar pauta, e o banco copia só a descrição deles.
 */

export type Cents = number;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_INSTALLMENTS = 36;
export const MAX_PAUTA_ITEMS = 40;
/** Etapas de um projeto que acabou de fechar (Pausado, Cancelado, Encerrado e Churn não). */
export const NEW_PROJECT_STAGES = ["planejamento", "pre_producao", "captacao", "producao", "edicao", "revisao_interna", "aprovacao_cliente", "alteracao", "entregue"] as const;
export type NewProjectStage = (typeof NEW_PROJECT_STAGES)[number];

// ---------------------------------------------------------------------------
// Parcelas
// ---------------------------------------------------------------------------

export interface InstallmentDraft {
  amountCents: Cents;
  dueDate: string;
}

/** Mesmo dia nos meses seguintes; dia 31 em fevereiro vira o último dia do mês. */
export function addMonthsKeepingDay(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Sugestão de parcelas iguais, mês a mês a partir da primeira data. Os centavos que sobram da divisão vão para
 * as primeiras parcelas (mesma divisão do Financeiro), então a soma é sempre exatamente o total.
 */
export function suggestInstallments(totalCents: Cents, count: number, firstDueDate: string): InstallmentDraft[] {
  const n = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(count) || 1));
  return splitInstallments(totalCents, n).map((amountCents, index) => ({
    amountCents,
    dueDate: firstDueDate ? addMonthsKeepingDay(firstDueDate, index) : "",
  }));
}

export interface InstallmentCheck {
  ok: boolean;
  sumCents: Cents;
  /** total − soma: positivo = falta lançar; negativo = passou do total. */
  differenceCents: Cents;
  errors: string[];
}

export function checkInstallments(totalCents: Cents, installments: readonly InstallmentDraft[]): InstallmentCheck {
  const errors: string[] = [];
  if (installments.length < 1 || installments.length > MAX_INSTALLMENTS) errors.push(`Informe de 1 a ${MAX_INSTALLMENTS} parcelas.`);
  installments.forEach((item, index) => {
    if (!Number.isInteger(item.amountCents) || item.amountCents <= 0) errors.push(`Parcela ${index + 1}: valor precisa ser maior que zero.`);
    if (!DAY.test(item.dueDate)) errors.push(`Parcela ${index + 1}: informe a data.`);
  });
  const sumCents = installments.reduce((sum, item) => sum + (Number.isInteger(item.amountCents) ? item.amountCents : 0), 0);
  const differenceCents = totalCents - sumCents;
  if (differenceCents !== 0) errors.push("A soma das parcelas precisa ser igual ao total do orçamento.");
  return { ok: errors.length === 0, sumCents, differenceCents, errors };
}

// ---------------------------------------------------------------------------
// Margem (só aviso na tela de aprovação — nada é notificado nem alterado)
// ---------------------------------------------------------------------------

/** marginPct em fração (0,25 = 25%), como computeBudget devolve. */
export function budgetMarginWarning(marginPct: number, thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS): string | null {
  const percent = marginPct * 100;
  if (!Number.isFinite(percent) || percent >= thresholds.attention) return null;
  return `Margem deste orçamento: ${String(Math.round(percent * 10) / 10).replace(".", ",")}%, abaixo de ${thresholds.attention}%. A meta saudável é ${thresholds.healthy}%. É só um aviso: a aprovação segue normalmente.`;
}

// ---------------------------------------------------------------------------
// Pedido de aprovação (o que a tela envia)
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();
const day = z.string().regex(DAY, "data inválida");

export const approvalInputSchema = z.object({
  note: z.string().trim().max(1000).default(""),
  company: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), id: uuid }),
    z.object({
      mode: z.literal("new"),
      name: z.string().trim().min(2, "informe o nome do cliente").max(160),
      document: z.string().trim().max(32).default(""),
      segment: z.string().trim().max(80).default(""),
      source: z.enum(["crm", "indicacao", "cliente_antigo", "instagram", "site", "evento", "prospeccao_ativa", "outro"]).nullable().default(null),
    }),
  ]),
  project: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), id: uuid }),
    z.object({
      mode: z.literal("new"),
      name: z.string().trim().min(2, "informe o nome do projeto").max(160),
      model: z.enum(["transacional", "recorrente"]),
      stage: z.enum(NEW_PROJECT_STAGES),
      /** Transacional: prazo de entrega. Recorrente: início do contrato. */
      date: day,
    }),
  ]),
  pautaItemIds: z.array(uuid).max(MAX_PAUTA_ITEMS, `escolha até ${MAX_PAUTA_ITEMS} itens`).default([]),
  payment: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("schedule"),
      method: z.enum(["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"]).nullable().default(null),
      installments: z.array(z.object({ amountCents: z.number().int().positive(), dueDate: day })).min(1).max(MAX_INSTALLMENTS),
    }),
    z.object({ mode: z.literal("delegate"), assigneeId: uuid }),
  ]),
});

export type ApprovalInput = z.input<typeof approvalInputSchema>;
export type ApprovalValues = z.output<typeof approvalInputSchema>;

/** Pedido no formato de public.approve_budget(p_payload). Valores em reais com 2 casas (exatos, vindos de centavos). */
export interface ApprovalPayload {
  note: string;
  company: { mode: "existing"; id: string } | { mode: "new"; name: string; document: string; segment: string; source: string | null };
  project: { mode: "existing"; id: string } | { mode: "new"; name: string; model: string; stage: string; date: string };
  pauta_item_ids: string[];
  payment:
    | { mode: "schedule"; method: string | null; installments: { amount: number; due_date: string }[] }
    | { mode: "delegate"; assignee_id: string };
}

export interface ApprovalBudgetFacts {
  totalCents: Cents;
  /** Negócio do CRM de onde veio o orçamento (o cliente tem de ser o do negócio). */
  dealCompanyId: string | null;
  /** Itens do orçamento (só id) — para conferir que as pautas saem deste orçamento. */
  itemIds: readonly string[];
}

export type BuildResult = { ok: true; payload: ApprovalPayload } | { ok: false; error: string };

export function buildApprovalPayload(input: ApprovalInput, budget: ApprovalBudgetFacts): BuildResult {
  const parsed = approvalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados da aprovação." };
  const values = parsed.data;

  if (budget.totalCents <= 0) return { ok: false, error: "O orçamento está sem valor." };
  if (budget.dealCompanyId && (values.company.mode !== "existing" || values.company.id !== budget.dealCompanyId)) {
    return { ok: false, error: "Este orçamento veio de um negócio do CRM: o cliente é o do negócio." };
  }
  if (values.company.mode === "new" && values.project.mode === "existing") {
    return { ok: false, error: "Cliente novo ainda não tem projeto: crie o projeto." };
  }
  const known = new Set(budget.itemIds);
  if (values.pautaItemIds.some((id) => !known.has(id))) return { ok: false, error: "Algum item escolhido para pauta não é deste orçamento." };

  let payment: ApprovalPayload["payment"];
  if (values.payment.mode === "schedule") {
    const check = checkInstallments(budget.totalCents, values.payment.installments);
    if (!check.ok) return { ok: false, error: check.errors[0] ?? "Revise as parcelas." };
    payment = {
      mode: "schedule",
      method: values.payment.method,
      installments: values.payment.installments.map((item) => ({ amount: item.amountCents / 100, due_date: item.dueDate })),
    };
  } else {
    payment = { mode: "delegate", assignee_id: values.payment.assigneeId };
  }

  return {
    ok: true,
    payload: {
      note: values.note,
      company: values.company.mode === "existing" ? { mode: "existing", id: values.company.id } : { ...values.company },
      project: values.project.mode === "existing" ? { mode: "existing", id: values.project.id } : { ...values.project },
      pauta_item_ids: [...new Set(values.pautaItemIds)],
      payment,
    },
  };
}

// ---------------------------------------------------------------------------
// Prévia: o que a aprovação vai criar (passo "Revisar"; o banco faz exatamente isto)
// ---------------------------------------------------------------------------

export interface PreviewItem {
  id: string;
  description: string;
}

export interface ApprovalPreview {
  company: { action: "link" | "create"; label: string };
  project: { action: "link" | "create"; label: string };
  receivables: { amountCents: Cents; dueDate: string | null; status: "pendente" | "data_a_definir"; label: string }[];
  pautas: { kind: "item" | "definir_data"; title: string; assigneeId: string | null }[];
  /** Custos lançados no projeto pela aprovação: sempre nenhum (os custos reais são lançados à mão). */
  projectCosts: [];
  dealWon: boolean;
}

export function delegatedPautaTitle(budgetNumber: number): string {
  return `Definir data de pagamento — Orçamento #${String(budgetNumber).padStart(4, "0")}`;
}

export function approvalPreview(
  values: ApprovalValues,
  budget: ApprovalBudgetFacts & { number: number; label: string; items: readonly PreviewItem[]; companyName?: string; projectName?: string; hasDeal: boolean },
): ApprovalPreview {
  const chosen = new Set(values.pautaItemIds);
  const receivables: ApprovalPreview["receivables"] =
    values.payment.mode === "schedule"
      ? values.payment.installments.map((item, index, all) => ({
          amountCents: item.amountCents,
          dueDate: item.dueDate,
          status: "pendente" as const,
          label: all.length > 1 ? `${budget.label} (${index + 1}/${all.length})` : budget.label,
        }))
      : [{ amountCents: budget.totalCents, dueDate: null, status: "data_a_definir" as const, label: budget.label }];
  const pautas: ApprovalPreview["pautas"] = budget.items.filter((item) => chosen.has(item.id)).map((item) => ({ kind: "item", title: item.description, assigneeId: null }));
  if (values.payment.mode === "delegate") pautas.push({ kind: "definir_data", title: delegatedPautaTitle(budget.number), assigneeId: values.payment.assigneeId });
  return {
    company: values.company.mode === "existing" ? { action: "link", label: budget.companyName ?? "Cliente cadastrado" } : { action: "create", label: values.company.name },
    project: values.project.mode === "existing" ? { action: "link", label: budget.projectName ?? "Projeto existente" } : { action: "create", label: values.project.name },
    receivables,
    pautas,
    projectCosts: [],
    dealWon: budget.hasDeal,
  };
}

// ---------------------------------------------------------------------------
// Execução: um único RPC transacional. Falhou → nada foi gravado e nada mais é chamado.
// ---------------------------------------------------------------------------

export interface ApprovalOutcome {
  companyId: string;
  projectId: string;
  receivableIds: string[];
  pautaIds: string[];
  dealId: string | null;
  dealResult: "sem_crm" | "ganho" | "ja_ganho" | "perdido";
  contractSet: boolean;
}

export type ApprovalRpc = (budgetId: string, payload: ApprovalPayload) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

/** Mensagens do banco com errcode 23514/22023/42501 já vêm em português para a pessoa; o resto vira genérico. */
function friendlyError(error: { message: string; code?: string }): string {
  return error.code && ["23514", "22023", "42501"].includes(error.code)
    ? error.message
    : "Não foi possível aprovar. Nada foi criado — tente de novo.";
}

export async function runApproval(rpc: ApprovalRpc, budgetId: string, payload: ApprovalPayload): Promise<{ ok: true; outcome: ApprovalOutcome } | { ok: false; error: string }> {
  const { data, error } = await rpc(budgetId, payload);
  if (error) return { ok: false, error: friendlyError(error) };
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    outcome: {
      companyId: String(row.company_id ?? ""),
      projectId: String(row.project_id ?? ""),
      receivableIds: Array.isArray(row.receivable_ids) ? row.receivable_ids.map(String) : [],
      pautaIds: Array.isArray(row.pauta_ids) ? row.pauta_ids.map(String) : [],
      dealId: typeof row.deal_id === "string" ? row.deal_id : null,
      dealResult: (["ganho", "ja_ganho", "perdido"].includes(String(row.deal_result)) ? row.deal_result : "sem_crm") as ApprovalOutcome["dealResult"],
      contractSet: row.contract_set === true,
    },
  };
}

export function approvalMessage(outcome: ApprovalOutcome, mode: ApprovalPayload["payment"]["mode"]): string {
  const parts = ["Orçamento aprovado."];
  parts.push(mode === "delegate" ? "Recebimento criado como “Data a definir” e a tarefa foi para o financeiro." : `${outcome.receivableIds.length === 1 ? "Recebimento criado" : `${outcome.receivableIds.length} parcelas criadas`} no Financeiro.`);
  if (outcome.pautaIds.length > 0) parts.push(`${outcome.pautaIds.length} ${outcome.pautaIds.length === 1 ? "pauta criada" : "pautas criadas"} no projeto.`);
  if (outcome.dealResult === "ganho") parts.push("Negócio marcado como ganho no CRM.");
  if (outcome.dealResult === "perdido") parts.push("O negócio está como Perdido no CRM — o vínculo foi mantido; ajuste lá se precisar.");
  return parts.join(" ");
}
