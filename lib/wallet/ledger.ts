import { dateInAppZone } from "@/lib/calendar";

/**
 * Extrato da Carteira (wallet_ledger_events): saídas (baixa do pagamento) e estornos (baixa desfeita), imutáveis.
 * O banco grava por gatilho (payables_wallet_ledger); ledgerTransition é a mesma regra em TypeScript, conferida
 * com os mesmos casos (lib/wallet/ledger-cases.json). Aqui também ficam os totais do extrato por mês e por ano.
 */

export type LedgerKind = "payout" | "reversal";

/** Estado do lançamento do Financeiro que importa para o extrato. */
export interface LedgerPayable {
  payeeId: string | null;
  amountCents: number;
  /** payables.paid_at (só a data). */
  paidAt: string | null;
  cancelled: boolean;
  reimbursement: boolean;
}

/** Saída ainda sem estorno. */
export interface OpenPayout {
  id: string;
  profileId: string;
  amountCents: number;
  paidOn: string;
  occurredAt: string;
  timeRecorded: boolean;
}

export interface NewLedgerEvent {
  kind: LedgerKind;
  profileId: string;
  amountCents: number;
  paidOn: string;
  occurredAt: string;
  timeRecorded: boolean;
  actorId: string | null;
  reversesEventId: string | null;
}

export interface LedgerContext {
  /** Agora (ISO). */
  now: string;
  /** Hoje em Fortaleza (yyyy-mm-dd). */
  today: string;
  actorId: string | null;
}

/** 12:00 de um dia em Fortaleza (-03:00, sem horário de verão) — hora usada quando o horário não foi registrado. */
export function noonInAppZone(day: string): string {
  return new Date(`${day}T12:00:00-03:00`).toISOString();
}

export function isWalletPayout(payable: LedgerPayable): boolean {
  return payable.paidAt !== null && payable.payeeId !== null && !payable.cancelled && !payable.reimbursement;
}

/** Eventos que uma mudança no lançamento gera (o mesmo que o gatilho do banco faz). */
export function ledgerTransition(open: OpenPayout | null, payable: LedgerPayable, ctx: LedgerContext): NewLedgerEvent[] {
  const eligible = isWalletPayout(payable);
  if (
    open &&
    eligible &&
    open.profileId === payable.payeeId &&
    open.amountCents === payable.amountCents &&
    open.paidOn === payable.paidAt
  ) {
    return [];
  }

  const events: NewLedgerEvent[] = [];
  if (open) {
    events.push({
      kind: "reversal",
      profileId: open.profileId,
      amountCents: open.amountCents,
      paidOn: open.paidOn,
      occurredAt: ctx.now,
      timeRecorded: true,
      actorId: ctx.actorId,
      reversesEventId: open.id,
    });
  }
  if (eligible && payable.paidAt && payable.payeeId) {
    const keepsTime = open !== null && open.paidOn === payable.paidAt;
    const today = payable.paidAt === ctx.today;
    events.push({
      kind: "payout",
      profileId: payable.payeeId,
      amountCents: payable.amountCents,
      paidOn: payable.paidAt,
      occurredAt: keepsTime ? open.occurredAt : today ? ctx.now : noonInAppZone(payable.paidAt),
      timeRecorded: keepsTime ? open.timeRecorded : today,
      actorId: ctx.actorId,
      reversesEventId: null,
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Extrato na tela
// ---------------------------------------------------------------------------

export interface LedgerEvent {
  id: string;
  payableId: string;
  kind: LedgerKind;
  amountCents: number;
  paidOn: string;
  occurredAt: string;
  timeRecorded: boolean;
  actorName: string | null;
  reversesEventId: string | null;
  description: string;
  companyName: string | null;
  projectName: string | null;
  goalTitle: string | null;
  category: string | null;
  teamType: "pro_labore" | "comissao" | "pagamento_colaborador" | null;
  isFixed: boolean;
  hasGoal: boolean;
  hasProject: boolean;
  dueDate: string | null;
  payoutDate: string | null;
  entryCreatedAt: string | null;
}

/** Saída soma, estorno subtrai. */
export function signedCents(event: Pick<LedgerEvent, "kind" | "amountCents">): number {
  return event.kind === "payout" ? event.amountCents : -event.amountCents;
}

/** Mês (yyyy-mm) do evento, em Fortaleza. */
export function ledgerMonth(event: Pick<LedgerEvent, "occurredAt">): string {
  return dateInAppZone(event.occurredAt).slice(0, 7);
}

export interface MonthStatement {
  events: LedgerEvent[];
  /** Líquido do mês: saídas − estornos. */
  totalCents: number;
  payoutsCents: number;
  reversalsCents: number;
}

/** Extrato de um mês (yyyy-mm), do mais recente para o mais antigo. */
export function statementForMonth(events: readonly LedgerEvent[], month: string): MonthStatement {
  const inMonth = events
    .filter((event) => ledgerMonth(event) === month)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const payoutsCents = inMonth.filter((event) => event.kind === "payout").reduce((sum, event) => sum + event.amountCents, 0);
  const reversalsCents = inMonth.filter((event) => event.kind === "reversal").reduce((sum, event) => sum + event.amountCents, 0);
  return { events: inMonth, totalCents: payoutsCents - reversalsCents, payoutsCents, reversalsCents };
}

/** Recebido (líquido) num ano (yyyy). */
export function receivedInYear(events: readonly LedgerEvent[], year: string): number {
  return events.filter((event) => ledgerMonth(event).startsWith(`${year}-`)).reduce((sum, event) => sum + signedCents(event), 0);
}

/** Saídas que já foram estornadas (para marcar na lista). */
export function reversedPayoutIds(events: readonly LedgerEvent[]): Set<string> {
  return new Set(events.flatMap((event) => (event.reversesEventId ? [event.reversesEventId] : [])));
}
