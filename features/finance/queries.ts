import "server-only";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PAYABLE_COST_TYPE_FILTERS, type PayableCostTypeFilter } from "@/features/finance/labels";
import { addDaysISO, type Period, todayISO } from "@/features/finance/period";
import { sumCents, toCents, type Cents } from "@/features/finance/money";
import {
  PAYABLE_STATUSES,
  RECEIVABLE_STATUSES,
  type AttentionItem,
  type CashFlowDay,
  type CategoryCostItem,
  type ClientFinanceRow,
  type DashboardKpis,
  type FinanceOptions,
  type MonthlySummaryItem,
  type NegotiationItem,
  type NegotiationTotals,
  type PayableItem,
  type PayableStatus,
  type PeriodSummary,
  type ProfitabilityItem,
  type ReceivableItem,
  type ReceivableStatus,
  type UpcomingItem,
} from "@/features/finance/types";
import type { Database } from "@/types/database";
import { getCompanySettings } from "@/features/settings/queries";
import { marginStatusFor } from "@/lib/margin";
import type { MarginStatus, PayableCategory, PaymentMethod } from "@/types";

const LIST_LIMIT = 500;

type ReceivableRow = Database["public"]["Views"]["receivables_with_status"]["Row"];
type PayableRow = Database["public"]["Views"]["payables_with_status"]["Row"];
type MonthlySummaryRow = Database["public"]["Views"]["finance_monthly_summary"]["Row"];
type ClientFinanceRow_ = Database["public"]["Views"]["finance_by_client"]["Row"];
type CashFlowRow = Database["public"]["Views"]["cash_flow_projection"]["Row"];

export class FinanceAccessError extends Error {
  constructor() {
    super("Sem acesso ao financeiro.");
  }
}

/** Nenhuma consulta financeira roda sem a capability; a RLS continua sendo a última barreira. */
async function financeClient() {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "finance")) throw new FinanceAccessError();
  return createClient();
}

/** Logo de cada cliente das linhas (uma consulta só) — as views do financeiro não trazem o logo. */
async function withCompanyLogos<T extends { companyId: string | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: T[],
): Promise<(T & { companyLogoUrl: string | null })[]> {
  const ids = [...new Set(rows.map((row) => row.companyId).filter((id): id is string => Boolean(id)))];
  const logos = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data } = await supabase.from("companies").select("id, logo_url").in("id", ids);
    for (const company of data ?? []) logos.set(company.id, company.logo_url);
  }
  return rows.map((row) => ({ ...row, companyLogoUrl: row.companyId ? (logos.get(row.companyId) ?? null) : null }));
}

function asStatus<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.find((item) => item === value) ?? null;
}

function mapReceivable(row: ReceivableRow): ReceivableItem | null {
  const status = asStatus(row.status, RECEIVABLE_STATUSES);
  if (!row.id || !row.company_id || !row.description || row.amount == null || !row.due_date || !status) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name ?? "—",
    projectId: row.project_id,
    projectName: row.project_name,
    description: row.description,
    serviceDescription: row.service_description,
    competenceMonth: row.competence_month,
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    amount: toCents(row.amount),
    dueDate: row.due_date,
    receivedAt: row.received_at,
    receivedAmount: row.received_amount == null ? null : toCents(row.received_amount),
    paymentMethod: row.payment_method,
    invoiceNumber: row.invoice_number,
    invoiceFilePath: row.invoice_file_path,
    notes: row.notes,
    status,
  };
}

function mapPayable(row: PayableRow): PayableItem | null {
  const status = asStatus(row.status, PAYABLE_STATUSES);
  if (!row.id || !row.category || !row.description || row.amount == null || !row.due_date || !status) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    companyId: row.company_id,
    payeeProfileId: row.payee_profile_id,
    payeeName: row.payee_name,
    payeeLabel: row.payee_label ?? "—",
    category: row.category,
    description: row.description,
    amount: toCents(row.amount),
    dueDate: row.due_date,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    notes: row.notes,
    isFixed: row.is_fixed ?? false,
    recurrence: row.recurrence ?? "none",
    recurrenceUntil: row.recurrence_until,
    recurrenceParentId: row.recurrence_parent_id,
    status,
    scheduledFor: row.scheduled_for,
    paidLate: row.paid_late ?? false,
    lateReason: row.late_reason,
    penaltyAmount: row.penalty_amount == null ? null : toCents(row.penalty_amount),
    penaltyReason: row.penalty_reason,
    originalAmount: row.original_amount == null ? null : toCents(row.original_amount),
    receiptUrl: row.payment_receipt_url,
    payee: {
      pixKeyType: row.payee_pix_key_type,
      pixKey: row.payee_pix_key,
      holderName: row.payee_holder_name,
      document: row.payee_document,
      bankName: row.payee_bank_name,
      agency: row.payee_bank_agency,
      account: row.payee_bank_account,
      accountType: row.payee_account_type,
    },
  };
}

function compact<T>(items: (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

/** Escapa curingas do LIKE para busca por texto digitado. */
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------

/** Todo filtro de lista aceita múltiplos valores (popover "Filtros" com seleção múltipla). */
export interface ReceivableFilters {
  period?: Period;
  status?: string[];
  companyId?: string[];
  projectId?: string[];
  method?: string[];
  search?: string;
}

function multiIn<T extends string>(values: string[] | undefined, allowed: readonly T[]): T[] {
  if (!values || values.length === 0) return [];
  return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

export async function listReceivables(filters: ReceivableFilters): Promise<ReceivableItem[]> {
  const supabase = await financeClient();
  let query = supabase.from("receivables_with_status").select("*").order("due_date").limit(LIST_LIMIT);

  const statuses = multiIn(filters.status, RECEIVABLE_STATUSES);
  if (statuses.length > 0) query = query.in("status", statuses);
  // "Atrasado" mostra todos os atrasados, independente do período.
  if (filters.period && !(statuses.length === 1 && statuses[0] === "atrasado")) {
    query = query.gte("due_date", filters.period.from).lte("due_date", filters.period.to);
  }
  if (filters.companyId && filters.companyId.length > 0) query = query.in("company_id", filters.companyId);
  if (filters.projectId && filters.projectId.length > 0) query = query.in("project_id", filters.projectId);
  if (filters.method && filters.method.length > 0) query = query.in("payment_method", filters.method as PaymentMethod[]);
  if (filters.search?.trim()) query = query.ilike("description", likePattern(filters.search.trim()));

  const { data, error } = await query;
  if (error) throw new Error("Falha ao carregar recebimentos.");
  return withCompanyLogos(supabase, compact((data ?? []).map(mapReceivable)));
}

function costTypeClause(value: PayableCostTypeFilter): string {
  switch (value) {
    case "fixo_empresa":
      return "and(is_fixed.eq.true,project_id.is.null)";
    case "variavel":
      return "is_fixed.eq.false";
    case "projeto":
      return "project_id.not.is.null";
    case "sem_projeto":
      return "project_id.is.null";
  }
}

export interface PayableFilters {
  period?: Period;
  status?: string[];
  category?: string[];
  payee?: string;
  projectId?: string[];
  companyId?: string[];
  method?: string[];
  isFixed?: boolean[];
  /** "Custos fixos da empresa" / "Custos variáveis" / "Custos de projeto" / "Custos sem projeto" — OR entre si. */
  costType?: string[];
  search?: string;
}

export async function listPayables(filters: PayableFilters): Promise<PayableItem[]> {
  const supabase = await financeClient();
  let query = supabase.from("payables_with_status").select("*").order("due_date").limit(LIST_LIMIT);

  const statuses = multiIn(filters.status, PAYABLE_STATUSES);
  if (statuses.length > 0) query = query.in("status", statuses);
  if (filters.period && !(statuses.length === 1 && statuses[0] === "atrasado")) {
    query = query.gte("due_date", filters.period.from).lte("due_date", filters.period.to);
  }
  if (filters.category && filters.category.length > 0) query = query.in("category", filters.category as PayableCategory[]);
  if (filters.projectId && filters.projectId.length > 0) query = query.in("project_id", filters.projectId);
  if (filters.companyId && filters.companyId.length > 0) query = query.in("company_id", filters.companyId);
  if (filters.method && filters.method.length > 0) query = query.in("payment_method", filters.method as PaymentMethod[]);
  const isFixedValue = filters.isFixed?.length === 1 ? filters.isFixed[0] : undefined;
  if (isFixedValue !== undefined) query = query.eq("is_fixed", isFixedValue);
  const costTypes = multiIn(filters.costType, PAYABLE_COST_TYPE_FILTERS);
  if (costTypes.length > 0) query = query.or(costTypes.map(costTypeClause).join(","));
  if (filters.payee?.trim()) query = query.ilike("payee_label", likePattern(filters.payee.trim()));
  if (filters.search?.trim()) {
    const pattern = likePattern(filters.search.trim());
    query = query.or(`description.ilike.${pattern},payee_label.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Falha ao carregar pagamentos.");
  return compact((data ?? []).map(mapPayable));
}

// ---------------------------------------------------------------------------
// Resumo do período
// ---------------------------------------------------------------------------

export async function getPeriodSummary(period: Period): Promise<PeriodSummary> {
  const supabase = await financeClient();
  const { from, to } = period;
  const inPeriod = `and(due_date.gte.${from},due_date.lte.${to}),and(received_at.gte.${from},received_at.lte.${to})`;
  const inPeriodPayable = `and(due_date.gte.${from},due_date.lte.${to}),and(paid_at.gte.${from},paid_at.lte.${to})`;

  const [receivables, overdue, payables] = await Promise.all([
    supabase.from("receivables_with_status").select("amount, received_amount, received_at, due_date, status").or(inPeriod),
    supabase.from("receivables_with_status").select("amount").eq("status", "atrasado"),
    supabase.from("payables_with_status").select("amount, paid_at, due_date, status").or(inPeriodPayable),
  ]);
  if (receivables.error || overdue.error || payables.error) throw new Error("Falha ao carregar o resumo financeiro.");

  const within = (date: string | null) => date !== null && date >= from && date <= to;

  const toReceive = sumCents(
    (receivables.data ?? [])
      .filter((row) => (row.status === "pendente" || row.status === "atrasado") && within(row.due_date))
      .map((row) => toCents(row.amount)),
  );
  const received = sumCents(
    (receivables.data ?? [])
      .filter((row) => row.status === "recebido" && within(row.received_at))
      .map((row) => toCents(row.received_amount)),
  );
  const toPay = sumCents(
    (payables.data ?? [])
      .filter((row) => (row.status === "pendente" || row.status === "atrasado") && within(row.due_date))
      .map((row) => toCents(row.amount)),
  );
  const paid = sumCents(
    (payables.data ?? []).filter((row) => row.status === "pago" && within(row.paid_at)).map((row) => toCents(row.amount)),
  );

  return {
    toReceive,
    received,
    overdueReceivables: {
      total: sumCents((overdue.data ?? []).map((row) => toCents(row.amount))),
      count: overdue.data?.length ?? 0,
    },
    toPay,
    paid,
    // (recebido + a receber) − (pago + a pagar), tudo dentro do período.
    expectedBalance: received + toReceive - (paid + toPay),
  };
}

// ---------------------------------------------------------------------------
// Por projeto e próximos vencimentos
// ---------------------------------------------------------------------------

function mapProfitability(row: Database["public"]["Views"]["project_profitability"]["Row"]): ProfitabilityItem | null {
  if (!row.project_id || !row.project_name) return null;
  return {
    projectId: row.project_id,
    projectName: row.project_name,
    companyId: row.company_id,
    companyName: row.company_name,
    dueDate: row.due_date,
    contractValue: row.contract_value == null ? null : toCents(row.contract_value),
    totalReceived: toCents(row.total_received),
    receivablePending: toCents(row.receivable_pending),
    payablesTotal: toCents(row.payables_total),
    payablesPaid: toCents(row.payables_paid),
    plannedMargin: row.planned_margin == null ? null : toCents(row.planned_margin),
    marginPct: row.margin_pct,
    marginStatus: (row.margin_status as ProfitabilityItem["marginStatus"]) ?? null,
  };
}

/** Projetos com alguma movimentação financeira, ordenados por data de entrega. */
export async function listProfitability(): Promise<ProfitabilityItem[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase
    .from("project_profitability")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error("Falha ao carregar a rentabilidade por projeto.");

  return withCompanyLogos(
    supabase,
    compact((data ?? []).map(mapProfitability)).filter(
      (item) => item.contractValue !== null || item.totalReceived + item.receivablePending + item.payablesTotal > 0,
    ),
  );
}

export async function getProjectProfitability(projectId: string): Promise<ProfitabilityItem | null> {
  const supabase = await financeClient();
  const { data, error } = await supabase.from("project_profitability").select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw new Error("Falha ao carregar a rentabilidade do projeto.");
  return data ? mapProfitability(data) : null;
}

export async function listUpcoming(days = 30): Promise<UpcomingItem[]> {
  const supabase = await financeClient();
  const today = todayISO();
  const until = addDaysISO(today, days);

  const [receivables, payables] = await Promise.all([
    supabase
      .from("receivables_with_status")
      .select("*")
      .in("status", ["pendente"])
      .gte("due_date", today)
      .lte("due_date", until),
    supabase
      .from("payables_with_status")
      .select("*")
      .in("status", ["pendente"])
      .gte("due_date", today)
      .lte("due_date", until),
  ]);
  if (receivables.error || payables.error) throw new Error("Falha ao carregar os próximos vencimentos.");

  const incoming: UpcomingItem[] = compact((receivables.data ?? []).map(mapReceivable)).map((item) => ({
    id: item.id,
    direction: "in",
    dueDate: item.dueDate,
    label: item.description,
    counterpart: item.companyName,
    amount: item.amount,
  }));
  const outgoing: UpcomingItem[] = compact((payables.data ?? []).map(mapPayable)).map((item) => ({
    id: item.id,
    direction: "out",
    dueDate: item.dueDate,
    label: item.description,
    counterpart: item.payeeLabel,
    amount: item.amount,
  }));

  return [...incoming, ...outgoing].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ---------------------------------------------------------------------------
// Projeto, empresa, início
// ---------------------------------------------------------------------------

export async function getProjectFinance(projectId: string) {
  const [receivables, payables, profitability] = await Promise.all([
    listReceivables({ projectId: [projectId] }),
    listPayables({ projectId: [projectId] }),
    getProjectProfitability(projectId),
  ]);
  return { receivables, payables, profitability };
}

export async function getCompanyFinance(companyId: string) {
  const [receivables, payables] = await Promise.all([
    listReceivables({ companyId: [companyId] }),
    listPayables({ companyId: [companyId] }),
  ]);
  const active = receivables.filter((item) => item.status !== "cancelado");
  return {
    receivables,
    payables,
    billed: sumCents(active.map((item) => item.amount)),
    received: sumCents(active.filter((item) => item.status === "recebido").map((item) => item.receivedAmount ?? 0)),
    open: sumCents(active.filter((item) => item.status === "pendente" || item.status === "atrasado").map((item) => item.amount)),
    costs: sumCents(payables.filter((item) => item.status !== "cancelado").map((item) => item.amount)),
  };
}

export async function getHomeFinanceCard() {
  const supabase = await financeClient();
  const today = todayISO();
  const weekEnd = addDaysISO(today, 7);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [overdueReceivables, overduePayables, incoming, outgoing, receivedMonth, paidMonth] = await Promise.all([
    supabase.from("receivables_with_status").select("amount").eq("status", "atrasado"),
    supabase.from("payables_with_status").select("amount").eq("status", "atrasado"),
    supabase.from("receivables_with_status").select("amount").eq("status", "pendente").gte("due_date", today).lte("due_date", weekEnd),
    supabase.from("payables_with_status").select("amount").eq("status", "pendente").gte("due_date", today).lte("due_date", weekEnd),
    supabase.from("receivables_with_status").select("received_amount").eq("status", "recebido").gte("received_at", monthStart).lte("received_at", today),
    supabase.from("payables_with_status").select("amount").eq("status", "pago").gte("paid_at", monthStart).lte("paid_at", today),
  ]);
  if (overdueReceivables.error || overduePayables.error || incoming.error || outgoing.error || receivedMonth.error || paidMonth.error) {
    throw new Error("Falha ao carregar o financeiro.");
  }

  const total = (rows: { amount: number | null }[] | null) => sumCents((rows ?? []).map((row) => toCents(row.amount)));
  const overdueTotal = total(overdueReceivables.data) + total(overduePayables.data);
  const overdueCount = (overdueReceivables.data?.length ?? 0) + (overduePayables.data?.length ?? 0);
  const received = sumCents((receivedMonth.data ?? []).map((row) => toCents(row.received_amount)));
  const paid = total(paidMonth.data);

  return {
    overdue: { total: overdueTotal, count: overdueCount },
    dueSoonIn: total(incoming.data),
    dueSoonOut: total(outgoing.data),
    monthResult: received - paid,
  };
}

/** Opções dos formulários e filtros. Tabelas não financeiras (RLS própria de cada uma). */
export async function getFinanceOptions(): Promise<FinanceOptions> {
  const supabase = await financeClient();
  const [companies, projects, members] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("projects").select("id, name, company_id").eq("is_internal", false).order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).neq("full_name", "").order("full_name"),
  ]);
  return {
    companies: companies.data ?? [],
    projects: projects.data ?? [],
    members: members.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Dashboard: indicadores do período, custos por categoria e itens em atraso
// ---------------------------------------------------------------------------

export async function getDashboardKpis(period: Period): Promise<DashboardKpis> {
  const supabase = await financeClient();
  const { from, to } = period;

  const [receivables, payables, overdueReceivables, overduePayables, profitability, settings] = await Promise.all([
    supabase
      .from("receivables_with_status")
      .select("amount, received_amount, status")
      .gte("due_date", from)
      .lte("due_date", to),
    supabase.from("payables_with_status").select("amount, is_fixed, status").gte("due_date", from).lte("due_date", to),
    supabase.from("receivables_with_status").select("amount").eq("status", "atrasado"),
    supabase.from("payables_with_status").select("amount").eq("status", "atrasado"),
    listProfitability(),
    getCompanySettings(),
  ]);
  if (receivables.error || payables.error || overdueReceivables.error || overduePayables.error) {
    throw new Error("Falha ao carregar os indicadores do financeiro.");
  }

  const receivableRows = (receivables.data ?? []).filter((row) => row.status !== "cancelado");
  const payableRows = (payables.data ?? []).filter((row) => row.status !== "cancelado");

  const billed = sumCents(receivableRows.map((row) => toCents(row.amount)));
  const received = sumCents(receivableRows.filter((row) => row.status === "recebido").map((row) => toCents(row.received_amount)));
  const toReceive = sumCents(
    receivableRows.filter((row) => row.status === "pendente" || row.status === "atrasado").map((row) => toCents(row.amount)),
  );
  const fixedCosts = sumCents(payableRows.filter((row) => row.is_fixed).map((row) => toCents(row.amount)));
  const variableCosts = sumCents(payableRows.filter((row) => !row.is_fixed).map((row) => toCents(row.amount)));
  const paid = sumCents(payableRows.filter((row) => row.status === "pago").map((row) => toCents(row.amount)));

  const marginValues = profitability.map((item) => item.marginPct).filter((value): value is number => value != null);
  const averageMarginPct = marginValues.length > 0 ? Math.round((marginValues.reduce((a, b) => a + b, 0) / marginValues.length) * 10) / 10 : null;
  const averageMarginStatus: MarginStatus | null =
    averageMarginPct == null ? null : marginStatusFor(averageMarginPct, settings.margin);

  const overdueTotal =
    sumCents((overdueReceivables.data ?? []).map((row) => toCents(row.amount))) +
    sumCents((overduePayables.data ?? []).map((row) => toCents(row.amount)));
  const overdueCount = (overdueReceivables.data?.length ?? 0) + (overduePayables.data?.length ?? 0);

  return {
    billed,
    received,
    toReceive,
    fixedCosts,
    variableCosts,
    netResult: received - paid,
    averageMarginPct,
    averageMarginStatus,
    overdue: { total: overdueTotal, count: overdueCount },
  };
}

export async function getCategoryCosts(period: Period): Promise<CategoryCostItem[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase
    .from("payables_with_status")
    .select("category, amount, is_fixed, status")
    .gte("due_date", period.from)
    .lte("due_date", period.to)
    .neq("status", "cancelado");
  if (error) throw new Error("Falha ao carregar os custos por categoria.");

  const totals = new Map<PayableCategory, { fixed: number; variable: number }>();
  for (const row of data ?? []) {
    if (!row.category) continue;
    const entry = totals.get(row.category) ?? { fixed: 0, variable: 0 };
    if (row.is_fixed) entry.fixed += toCents(row.amount);
    else entry.variable += toCents(row.amount);
    totals.set(row.category, entry);
  }
  return Array.from(totals.entries())
    .map(([category, sums]) => ({ category, fixedTotal: sums.fixed, variableTotal: sums.variable }))
    .sort((a, b) => b.fixedTotal + b.variableTotal - (a.fixedTotal + a.variableTotal));
}

function daysOverdue(dueDate: string, today: string) {
  const due = new Date(`${dueDate}T12:00:00Z`).getTime();
  const now = new Date(`${today}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((now - due) / 86_400_000));
}

/** Recebimentos e pagamentos em atraso, dos mais antigos aos mais recentes. Para "Atenção agora". */
export async function getAttentionItems(limit = 30): Promise<AttentionItem[]> {
  const [receivables, payables] = await Promise.all([
    listReceivables({ status: ["atrasado"] }),
    listPayables({ status: ["atrasado"] }),
  ]);
  const today = todayISO();

  const incoming: AttentionItem[] = receivables.map((item) => ({
    id: item.id,
    direction: "in",
    dueDate: item.dueDate,
    label: item.description,
    counterpart: item.companyName,
    amount: item.amount,
    daysOverdue: daysOverdue(item.dueDate, today),
    href: `/clientes/${item.companyId}`,
  }));
  const outgoing: AttentionItem[] = payables.map((item) => ({
    id: item.id,
    direction: "out",
    dueDate: item.dueDate,
    label: item.description,
    counterpart: item.payeeLabel,
    amount: item.amount,
    daysOverdue: daysOverdue(item.dueDate, today),
    href: item.projectId ? `/projetos/${item.projectId}?aba=financeiro` : "/financeiro?aba=pagamentos&status=atrasado",
  }));

  return [...incoming, ...outgoing].sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Dashboard: séries de 18 meses, por cliente e projeção de caixa (views prontas)
// ---------------------------------------------------------------------------

function mapMonthlySummary(row: MonthlySummaryRow): MonthlySummaryItem | null {
  if (!row.month_start || !row.month_end) return null;
  return {
    monthStart: row.month_start,
    monthEnd: row.month_end,
    totalReceived: toCents(row.total_received),
    totalToReceive: toCents(row.total_to_receive),
    totalPaid: toCents(row.total_paid),
    totalToPay: toCents(row.total_to_pay),
    fixedCosts: toCents(row.fixed_costs),
    variableCosts: toCents(row.variable_costs),
    netResult: toCents(row.net_result),
    overdueReceivablesCount: row.overdue_receivables_count ?? 0,
    overduePayablesCount: row.overdue_payables_count ?? 0,
  };
}

export async function getMonthlySummary(): Promise<MonthlySummaryItem[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase.from("finance_monthly_summary").select("*");
  if (error) throw new Error("Falha ao carregar o resumo mensal.");
  return compact((data ?? []).map(mapMonthlySummary));
}

function mapClientFinance(row: ClientFinanceRow_): ClientFinanceRow | null {
  if (!row.company_id || !row.company_name) return null;
  return {
    companyId: row.company_id,
    companyName: row.company_name,
    totalBilled: toCents(row.total_billed),
    totalReceived: toCents(row.total_received),
    totalPending: toCents(row.total_pending),
    totalCosts: toCents(row.total_costs),
    marginPct: row.margin_pct,
    marginStatus: (row.margin_status as MarginStatus) ?? null,
    projectCount: row.project_count ?? 0,
  };
}

export async function getFinanceByClient(): Promise<ClientFinanceRow[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase.from("finance_by_client").select("*").order("total_billed", { ascending: false });
  if (error) throw new Error("Falha ao carregar o financeiro por cliente.");
  return withCompanyLogos(supabase, compact((data ?? []).map(mapClientFinance)));
}

function mapCashFlowDay(row: CashFlowRow): CashFlowDay | null {
  if (!row.day) return null;
  return {
    day: row.day,
    expectedInflow: toCents(row.expected_inflow),
    expectedOutflow: toCents(row.expected_outflow),
    netChange: toCents(row.net_change),
    runningBalance: toCents(row.running_balance),
  };
}

export async function getCashFlowProjection(): Promise<CashFlowDay[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase.from("cash_flow_projection").select("*");
  if (error) throw new Error("Falha ao carregar a projeção de caixa.");
  return compact((data ?? []).map(mapCashFlowDay));
}

export type { ReceivableStatus, PayableStatus };

// ---------------------------------------------------------------------------
// Em negociação (projeção do CRM)
// ---------------------------------------------------------------------------

/** Negócios com proposta registrada, ainda em aberto — a função do banco já exige acesso ao financeiro. */
export async function getDealsInNegotiation(): Promise<NegotiationItem[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase.rpc("finance_deals_in_negotiation");
  if (error) throw new Error("Falha ao carregar os negócios em negociação.");
  const items: NegotiationItem[] = (data ?? []).map((row) => ({
    dealId: row.deal_id,
    code: row.code,
    title: row.title,
    companyId: row.company_id,
    companyName: row.company_name,
    stage: row.stage,
    ownerName: row.owner_name,
    proposalAmount: toCents(row.proposal_amount),
    proposalSentAt: row.proposal_sent_at,
    proposalStatus: row.proposal_status,
    expectedCloseDate: row.expected_close_date,
    probability: Number(row.probability),
    weightedAmount: toCents(row.weighted_amount),
  }));
  return withCompanyLogos(supabase, items);
}

export interface BudgetNegotiationItem {
  budgetId: string;
  label: string;
  clientName: string;
  title: string;
  status: "enviado" | "em_ajuste";
  total: number;
  sentAt: string | null;
  validUntil: string;
}

/** Orçamentos enviados/em ajuste que não viraram proposta de um negócio do CRM (sem duplicar). */
export async function getBudgetsInNegotiation(): Promise<BudgetNegotiationItem[]> {
  const supabase = await financeClient();
  const { data, error } = await supabase.rpc("finance_budgets_in_negotiation");
  if (error) return [];
  return (data ?? []).flatMap((row) =>
    row.status === "enviado" || row.status === "em_ajuste"
      ? [
          {
            budgetId: row.budget_id,
            label: `Orçamento ${String(row.number).padStart(4, "0")}${row.version > 1 ? ` v${row.version}` : ""}`,
            clientName: row.client_name,
            title: row.title,
            status: row.status,
            total: toCents(row.total),
            sentAt: row.sent_at,
            validUntil: row.valid_until,
          },
        ]
      : [],
  );
}

export function summarizeNegotiation(items: NegotiationItem[]): NegotiationTotals {
  return {
    count: items.length,
    total: sumCents(items.map((item) => item.proposalAmount)),
    weighted: sumCents(items.map((item) => item.weightedAmount)),
  };
}

export async function getStageProbabilities() {
  const supabase = await financeClient();
  const { data, error } = await supabase.from("deal_stage_probabilities").select("stage, probability");
  if (error) throw new Error("Falha ao carregar as probabilidades por etapa.");
  return data ?? [];
}

export interface ClientFinanceSummary {
  billed: number;
  received: number;
  open: number;
  /** Faturamento ÷ projetos do cliente com movimento financeiro (null sem projeto). */
  averageTicket: number | null;
  marginPct: number | null;
  marginStatus: MarginStatus | null;
}

/** Resumo financeiro da visão geral do cliente — mesmas regras da aba Financeiro e da tabela por cliente. */
export async function getClientFinanceSummary(companyId: string): Promise<ClientFinanceSummary> {
  const supabase = await financeClient();
  const [finance, byClient] = await Promise.all([
    getCompanyFinance(companyId),
    supabase.from("finance_by_client").select("*").eq("company_id", companyId).maybeSingle(),
  ]);
  if (byClient.error) throw new Error("Falha ao carregar o financeiro do cliente.");
  const row = byClient.data ? mapClientFinance(byClient.data) : null;
  const projectCount = row?.projectCount ?? 0;

  return {
    billed: finance.billed,
    received: finance.received,
    open: finance.open,
    averageTicket: projectCount > 0 ? Math.round(finance.billed / projectCount) : null,
    marginPct: row?.marginPct ?? null,
    marginStatus: row?.marginStatus ?? null,
  };
}

export interface MarginBelowTargetItem {
  projectId: string;
  projectName: string;
  companyName: string | null;
  contractValue: Cents;
  payablesTotal: Cents;
  marginPct: number;
}

/** Projetos entre o crítico e a meta (30–40%): o relatório mensal de margem. Abaixo do crítico vai por alerta imediato. */
export async function getMarginBelowTarget(): Promise<MarginBelowTargetItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_margin_below_target");
  if (error) return [];
  return (data ?? []).map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name,
    companyName: row.company_name,
    contractValue: toCents(row.contract_value),
    payablesTotal: toCents(row.payables_total),
    marginPct: Number(row.margin_pct),
  }));
}

export interface LatePaymentItem {
  payableId: string;
  payee: string;
  description: string;
  projectName: string | null;
  dueDate: string;
  paidAt: string;
  daysLate: number;
  amount: Cents;
  penaltyAmount: Cents | null;
  lateReason: string | null;
  penaltyReason: string | null;
}

/** Pagamentos feitos com atraso num período (bloco do fechamento mensal). */
export async function getLatePayments(from: string, to: string): Promise<LatePaymentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_late_payments", { p_from: from, p_to: to });
  if (error) return [];
  return (data ?? []).map((row) => ({
    payableId: row.payable_id,
    payee: row.payee,
    description: row.description,
    projectName: row.project_name,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    daysLate: row.days_late,
    amount: toCents(row.amount),
    penaltyAmount: row.penalty_amount == null ? null : toCents(row.penalty_amount),
    lateReason: row.late_reason,
    penaltyReason: row.penalty_reason,
  }));
}

/** Pagamentos agendados para hoje (ou antes) ainda sem baixa — /inicio do financeiro. */
export async function getScheduledPaymentsDue(today: string): Promise<{ id: string; payee: string; description: string; amount: Cents; scheduledFor: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payables_with_status")
    .select("id, payee_label, description, amount, scheduled_for")
    .is("paid_at", null)
    .is("cancelled_at", null)
    .lte("scheduled_for", today)
    .order("scheduled_for")
    .limit(20);
  if (error) return [];
  return (data ?? [])
    .filter((row) => row.id && row.scheduled_for)
    .map((row) => ({ id: row.id!, payee: row.payee_label ?? "—", description: row.description ?? "", amount: toCents(row.amount), scheduledFor: row.scheduled_for! }));
}
