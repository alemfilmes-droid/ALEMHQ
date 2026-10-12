/**
 * Excluir clientes (Bloco 8C). Espelha as regras do banco (client_deletion_summary / client_delete /
 * client_purge): sem nenhum histórico → apagar de vez; com histórico → Lixeira (nada é apagado);
 * da Lixeira, "Excluir definitivamente" só sem lançamentos financeiros e sem contar em metas.
 * As mesmas regras são conferidas no SQL com os casos de deletion-cases.json.
 */

export interface DeletionCounts {
  projects_total: number;
  projects_active: number;
  pautas_open: number;
  deals_total: number;
  deals_open: number;
  cadences_active: number;
  meetings_future: number;
  meetings_past: number;
  budgets: number;
  goal_contributions: number;
  receivables_open: number;
  receivables_paid: number;
  receivables_cancelled: number;
  payables_open: number;
  payables_paid: number;
  payables_cancelled: number;
  contacts: number;
}

export interface FutureMeeting {
  id: string;
  title: string;
  starts_at: string;
  owner: string | null;
  on_google: boolean;
}

export interface DeletionSummary extends DeletionCounts {
  meetings: FutureMeeting[];
  has_dependencies: boolean;
  can_purge: boolean;
}

export const CONFIRM_ANONYMIZE = "ANONIMIZAR";
export const DELETED_SUFFIX = " (cliente excluído)";
export const PURGE_BLOCKED_FINANCE = "Este cliente tem lançamentos financeiros e não pode ser apagado definitivamente.";
export const PURGE_BLOCKED_GOALS = "Este cliente conta em metas da equipe e não pode ser apagado definitivamente.";

/** Contatos não contam: eles saem junto com o cliente. */
const DEPENDENCY_KEYS = [
  "projects_total",
  "pautas_open",
  "deals_total",
  "meetings_future",
  "meetings_past",
  "budgets",
  "goal_contributions",
  "receivables_open",
  "receivables_paid",
  "receivables_cancelled",
  "payables_open",
  "payables_paid",
  "payables_cancelled",
] as const satisfies readonly (keyof DeletionCounts)[];

export function financialEntries(counts: DeletionCounts): number {
  return (
    counts.receivables_open + counts.receivables_paid + counts.receivables_cancelled + counts.payables_open + counts.payables_paid + counts.payables_cancelled
  );
}

export function hasDependencies(counts: DeletionCounts): boolean {
  return DEPENDENCY_KEYS.some((key) => counts[key] > 0);
}

/** Motivo que trava "Excluir definitivamente" (null = liberado). */
export function purgeBlocker(counts: DeletionCounts): string | null {
  if (financialEntries(counts) > 0) return PURGE_BLOCKED_FINANCE;
  if (counts.goal_contributions > 0) return PURGE_BLOCKED_GOALS;
  return null;
}

/** Confirmação por digitação: o nome exato (espaços nas pontas e repetidos não contam). */
export function confirmationMatches(typed: string, expected: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
  return normalize(typed) !== "" && normalize(typed) === normalize(expected);
}

/** Nome do cliente nos relatórios do financeiro depois da exclusão. */
export function deletedClientLabel(name: string, deletedAt: string | null): string {
  return deletedAt ? `${name}${DELETED_SUFFIX}` : name;
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

function parts(entries: [number, string, string][]): string {
  return entries
    .filter(([value]) => value > 0)
    .map(([value, one, many]) => count(value, one, many))
    .join(", ");
}

/** Resumo em português simples do que está ligado ao cliente (só o que existe). */
export function dependencyLines(counts: DeletionCounts): string[] {
  const lines: string[] = [];
  if (counts.projects_total > 0) {
    lines.push(`${count(counts.projects_total, "projeto", "projetos")}${counts.projects_active > 0 ? ` (${count(counts.projects_active, "ativo", "ativos")})` : ""}`);
  }
  if (counts.pautas_open > 0) lines.push(count(counts.pautas_open, "pauta aberta", "pautas abertas"));
  if (counts.deals_total > 0) {
    const detail = parts([
      [counts.deals_open, "em andamento", "em andamento"],
      [counts.cadences_active, "com cadência ativa", "com cadência ativa"],
    ]);
    lines.push(`${count(counts.deals_total, "negócio no CRM", "negócios no CRM")}${detail ? ` (${detail})` : ""}`);
  }
  const meetings = parts([
    [counts.meetings_future, "reunião futura", "reuniões futuras"],
    [counts.meetings_past, "reunião passada", "reuniões passadas"],
  ]);
  if (meetings) lines.push(meetings);
  if (counts.budgets > 0) lines.push(count(counts.budgets, "orçamento", "orçamentos"));
  if (counts.goal_contributions > 0) lines.push(count(counts.goal_contributions, "lançamento em metas", "lançamentos em metas"));
  const receivables = parts([
    [counts.receivables_open, "em aberto", "em aberto"],
    [counts.receivables_paid, "recebido", "recebidos"],
    [counts.receivables_cancelled, "cancelado", "cancelados"],
  ]);
  if (receivables) lines.push(`Recebimentos: ${receivables}`);
  const payables = parts([
    [counts.payables_open, "em aberto", "em aberto"],
    [counts.payables_paid, "pago", "pagos"],
    [counts.payables_cancelled, "cancelado", "cancelados"],
  ]);
  if (payables) lines.push(`Pagamentos: ${payables}`);
  return lines;
}

export const DELETION_ACTIONS = ["excluido", "excluido_permanentemente", "restaurado", "excluido_definitivamente", "anonimizado"] as const;
export type DeletionAction = (typeof DELETION_ACTIONS)[number];

export const DELETION_ACTION_LABELS: Record<DeletionAction, string> = {
  excluido: "Enviado para a Lixeira",
  excluido_permanentemente: "Excluído permanentemente (sem histórico)",
  restaurado: "Restaurado",
  excluido_definitivamente: "Excluído definitivamente da Lixeira",
  anonimizado: "Anonimizado (LGPD)",
};
