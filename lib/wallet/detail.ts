import type { LedgerEvent } from "@/lib/wallet/ledger";
import { walletKindOf, type WalletKind, type WalletLine } from "@/lib/wallet/wallet";

/** Detalhe de um item da Carteira (gaveta): dados do lançamento e a linha do tempo lançado → previsto → pago. */

export type TimelineState = "done" | "upcoming" | "reversed";

export interface TimelineStep {
  key: string;
  label: string;
  /** ISO (com hora) ou yyyy-mm-dd (só data). */
  at: string | null;
  withTime: boolean;
  note: string | null;
  state: TimelineState;
}

export type WalletDetailStatus = "a_receber" | "pago" | "estornado" | "automatico";

export interface WalletDetail {
  key: string;
  description: string;
  amountCents: number;
  kind: WalletKind;
  reversal: boolean;
  companyName: string | null;
  projectName: string | null;
  goalTitle: string | null;
  dueDate: string | null;
  payoutDate: string | null;
  status: WalletDetailStatus;
  timeline: TimelineStep[];
}

function eventSteps(events: readonly LedgerEvent[]): TimelineStep[] {
  return [...events]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || (a.kind === "payout" ? -1 : 1))
    .map((event) =>
      event.kind === "payout"
        ? {
            key: event.id,
            label: "Pago",
            at: event.timeRecorded ? event.occurredAt : event.paidOn,
            withTime: event.timeRecorded,
            note: [event.actorName ? `Confirmado por ${event.actorName}` : "Quem confirmou não foi registrado", event.timeRecorded ? null : "horário não registrado"]
              .filter(Boolean)
              .join(" · "),
            state: "done" as const,
          }
        : {
            key: event.id,
            label: "Estornado",
            at: event.occurredAt,
            withTime: true,
            note: event.actorName ? `Por ${event.actorName} · voltou para A receber` : "Voltou para A receber",
            state: "reversed" as const,
          },
    );
}

function timeline(createdAt: string | null, payoutDate: string | null, events: readonly LedgerEvent[], today: string, virtual: boolean): TimelineStep[] {
  const steps: TimelineStep[] = [
    virtual
      ? { key: "lancado", label: "Calculado pela remuneração", at: null, withTime: false, note: "O financeiro ainda vai lançar este valor.", state: "upcoming" }
      : { key: "lancado", label: "Lançado no Financeiro", at: createdAt, withTime: createdAt !== null, note: null, state: "done" },
    {
      key: "previsto",
      label: "Previsto para cair",
      at: payoutDate,
      withTime: false,
      note: null,
      state: payoutDate !== null && payoutDate <= today ? "done" : "upcoming",
    },
    ...eventSteps(events),
  ];
  const reversed = new Set(events.flatMap((event) => (event.reversesEventId ? [event.reversesEventId] : [])));
  const paidNow = events.some((event) => event.kind === "payout" && !reversed.has(event.id));
  if (!paidNow) steps.push({ key: "pago", label: "Pago", at: null, withTime: false, note: "Aguardando o pagamento", state: "upcoming" });
  return steps;
}

/** Item de "A receber". */
export function detailFromLine(line: WalletLine, ledger: readonly LedgerEvent[], today: string): WalletDetail {
  const events = line.virtual ? [] : ledger.filter((event) => event.payableId === line.id);
  return {
    key: line.id,
    description: line.description,
    amountCents: line.amountCents,
    kind: line.kind,
    reversal: false,
    companyName: line.companyName,
    projectName: line.projectName,
    goalTitle: line.goalTitle,
    dueDate: line.virtual ? null : line.dueDate,
    payoutDate: line.payoutDate,
    status: line.virtual ? "automatico" : "a_receber",
    timeline: timeline(line.createdAt, line.payoutDate, events, today, line.virtual),
  };
}

/** Item do Histórico (saída ou estorno). */
export function detailFromEvent(event: LedgerEvent, ledger: readonly LedgerEvent[], today: string): WalletDetail {
  const events = ledger.filter((item) => item.payableId === event.payableId);
  const reversed = new Set(events.flatMap((item) => (item.reversesEventId ? [item.reversesEventId] : [])));
  return {
    key: event.id,
    description: event.description,
    amountCents: event.amountCents,
    kind: eventKind(event),
    reversal: event.kind === "reversal",
    companyName: event.companyName,
    projectName: event.projectName,
    goalTitle: event.goalTitle,
    dueDate: event.dueDate,
    payoutDate: event.payoutDate,
    status: event.kind === "reversal" || reversed.has(event.id) ? "estornado" : "pago",
    timeline: timeline(event.entryCreatedAt, event.payoutDate, events, today, false),
  };
}

export function eventKind(event: LedgerEvent): WalletKind {
  return walletKindOf({ teamType: event.teamType, category: event.category ?? "outro", isFixed: event.isFixed, hasGoal: event.hasGoal, hasProject: event.hasProject });
}
