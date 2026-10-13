import "server-only";
import { COMPANY_COST_GROUPS, type CompanyCostGroup } from "@/features/finance/labels";
import { toCents, type Cents } from "@/features/finance/money";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { costGroupOf, isCompanyCost, summarizeCompanyCosts } from "@/lib/finance/company-costs";
import { type TeamPaymentType } from "@/lib/finance/team-category";
import { createClient } from "@/lib/supabase/server";
import type { PayableCategory } from "@/types";

/** Filtros da aba "Custos da empresa" (?mes=yyyy-mm&categoria=&pessoa=&fixo=). "categoria" = cartões (grupos). */
export interface CompanyCostFilters {
  month: string;
  groups: CompanyCostGroup[];
  personIds: string[];
  /** true = só fixos, false = só variáveis, undefined = todos. */
  fixed?: boolean;
}

export interface CompanyCostLine {
  id: string;
  description: string;
  category: PayableCategory;
  teamType: TeamPaymentType | null;
  group: CompanyCostGroup;
  costScope: "empresa" | "projeto";
  /** Pró-labore ligado a um projeto: o nome do projeto. */
  projectName: string | null;
  isReimbursement: boolean;
  payeeLabel: string | null;
  payeeProfileId: string | null;
  amount: Cents;
  isFixed: boolean;
  dueDate: string;
  status: string;
}

export interface CompanyCostGroupTotal {
  group: CompanyCostGroup;
  total: Cents;
  fixed: Cents;
  variable: Cents;
  /** Parte ligada a projetos (só no Pró-labore). */
  linkedToProjects: Cents;
  /** Equipe e colaboradores por tipo (só no grupo Equipe). */
  teamBreakdown: { type: TeamPaymentType; total: Cents }[];
}

export interface CompanyCostPerson {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  total: Cents;
}

export interface CompanyCostMonth {
  /** yyyy-mm */
  month: string;
  fixed: Cents;
  variable: Cents;
  revenue: Cents;
  /** % do faturamento consumido pelos custos fixos da empresa (null sem faturamento). */
  fixedShare: number | null;
}

export interface CompanyCostsData {
  month: string;
  total: Cents;
  fixedTotal: Cents;
  variableTotal: Cents;
  revenue: Cents;
  fixedShare: number | null;
  groups: CompanyCostGroupTotal[];
  people: CompanyCostPerson[];
  evolution: CompanyCostMonth[];
  lines: CompanyCostLine[];
}

const MONTH = /^\d{4}-\d{2}$/;

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year = 0, month = 1] = yearMonth.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function monthEnd(yearMonth: string): string {
  const [year = 0, month = 1] = yearMonth.split("-").map(Number);
  return `${yearMonth}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}

export function parseCompanyCostFilters(params: Record<string, string | undefined>, currentMonth: string): CompanyCostFilters {
  const list = (value: string | undefined) => (value ? value.split(",").filter(Boolean) : []);
  const fixed = list(params.fixo);
  return {
    month: params.mes && MONTH.test(params.mes) ? params.mes : currentMonth,
    groups: list(params.categoria).filter((value): value is CompanyCostGroup => (COMPANY_COST_GROUPS as readonly string[]).includes(value)),
    personIds: list(params.pessoa).filter((value) => /^[0-9a-f-]{36}$/i.test(value)),
    fixed: fixed.length === 1 ? fixed[0] === "fixo" : undefined,
  };
}

/**
 * Tudo o que a empresa custa para funcionar: pagamentos com cost_scope = 'empresa' (sem projeto) e o
 * pró-labore dos sócios (mesmo ligado a projeto), não cancelados, pelo vencimento — regra em
 * lib/finance/company-costs.ts. Mês selecionado + 11 anteriores para a evolução, e o faturamento
 * (recebimentos não cancelados pelo vencimento) para a comparação com os custos fixos.
 * Exige a capability "finance"; a RLS de payables/receivables é a última barreira.
 */
export async function getCompanyCosts(filters: CompanyCostFilters): Promise<CompanyCostsData> {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "finance")) throw new Error("Sem acesso ao financeiro.");
  const supabase = await createClient();

  const first = shiftYearMonth(filters.month, -11);
  const from = `${first}-01`;
  const to = monthEnd(filters.month);

  let payablesQuery = supabase
    .from("payables_with_status")
    .select("id, description, category, team_payment_type, cost_scope, project_name, is_reimbursement, payee_label, payee_profile_id, amount, is_fixed, due_date, status")
    .or("cost_scope.eq.empresa,team_payment_type.eq.pro_labore,category.eq.pro_labore")
    .neq("status", "cancelado")
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date", { ascending: true });
  if (filters.personIds.length > 0) payablesQuery = payablesQuery.in("payee_profile_id", filters.personIds);
  if (filters.fixed !== undefined) payablesQuery = payablesQuery.eq("is_fixed", filters.fixed);

  const [payables, receivables, people] = await Promise.all([
    payablesQuery,
    supabase.from("receivables_with_status").select("amount, due_date, status").neq("status", "cancelado").gte("due_date", from).lte("due_date", to),
    supabase.from("profiles").select("id, full_name, avatar_url"),
  ]);
  if (payables.error || receivables.error) throw new Error("Falha ao carregar os custos da empresa.");

  const lines: CompanyCostLine[] = (payables.data ?? []).flatMap((row) => {
    if (!row.id || !row.category || !row.due_date) return [];
    const base = { category: row.category, teamType: row.team_payment_type, costScope: row.cost_scope === "projeto" ? ("projeto" as const) : ("empresa" as const) };
    if (!isCompanyCost(base)) return [];
    const group = costGroupOf(base);
    if (filters.groups.length > 0 && !filters.groups.includes(group)) return [];
    return [
      {
        ...base,
        id: row.id,
        description: row.description ?? "",
        group,
        projectName: base.costScope === "projeto" ? row.project_name : null,
        isReimbursement: row.is_reimbursement === true,
        payeeLabel: row.payee_label,
        payeeProfileId: row.payee_profile_id,
        amount: toCents(row.amount),
        isFixed: row.is_fixed === true,
        dueDate: row.due_date,
        status: row.status ?? "pendente",
      },
    ];
  });

  const months = Array.from({ length: 12 }, (_, index) => shiftYearMonth(first, index));
  const revenueByMonth = new Map<string, Cents>();
  for (const row of receivables.data ?? []) {
    if (!row.due_date) continue;
    const key = row.due_date.slice(0, 7);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + toCents(row.amount));
  }

  const evolution: CompanyCostMonth[] = months.map((month) => {
    const summary = summarizeCompanyCosts(lines, month, revenueByMonth.get(month) ?? 0);
    return { month, fixed: summary.fixed, variable: summary.variable, revenue: revenueByMonth.get(month) ?? 0, fixedShare: summary.fixedShare };
  });

  const monthLines = lines.filter((line) => line.dueDate.startsWith(filters.month));
  const groups: CompanyCostGroupTotal[] = summarizeCompanyCosts(lines, filters.month, revenueByMonth.get(filters.month) ?? 0).groups;

  const profiles = new Map((people.data ?? []).map((person) => [person.id, person]));
  const perPerson = new Map<string, Cents>();
  // Custo por colaborador: sem pró-labore (retirada dos sócios) e sem reembolso (não é remuneração).
  for (const line of monthLines) {
    if (line.group === "pro_labore" || line.isReimbursement) continue;
    if (line.payeeProfileId) perPerson.set(line.payeeProfileId, (perPerson.get(line.payeeProfileId) ?? 0) + line.amount);
  }
  const personList: CompanyCostPerson[] = [...perPerson.entries()]
    .map(([profileId, total]) => ({
      profileId,
      total,
      name: profiles.get(profileId)?.full_name ?? "—",
      avatarUrl: profiles.get(profileId)?.avatar_url ?? null,
    }))
    .sort((a, b) => b.total - a.total);

  const current = evolution.at(-1) ?? { fixed: 0, variable: 0, revenue: 0, fixedShare: null };

  return {
    month: filters.month,
    total: current.fixed + current.variable,
    fixedTotal: current.fixed,
    variableTotal: current.variable,
    revenue: current.revenue,
    fixedShare: current.fixedShare,
    groups,
    people: personList,
    evolution,
    lines: monthLines.sort((a, b) => b.amount - a.amount),
  };
}
