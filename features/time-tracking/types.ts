import type { Squad, TimeBalanceSummaryRow, TimeDailySummaryRow, TimeEntry } from "@/types";

/** Última entrada de hoje (ou não), usada pelo card "Ponto do dia". */
export interface OpenSessionState {
  /** Entrada em aberto (sem saída depois). Nulo quando o dia está encerrado ou nem começou. */
  openEntry: TimeEntry | null;
  /** Há pelo menos um registro hoje (mesmo já encerrado) — decide "Começar" vs "Retomar". */
  hasEntriesToday: boolean;
  todayEntries: TimeEntry[];
  todaySummary: TimeDailySummaryRow | null;
  /** Segundos já fechados hoje (pares entrada→saída completos) — exclui a sessão em aberto, se houver. */
  closedSecondsToday: number;
}

export interface BalanceKpis {
  totalBalanceMinutes: number;
  monthBalanceMinutes: number;
  weekBalanceMinutes: number;
  totalWorkedMinutes: number;
  dailyHours: number;
  workedThisMonthMinutes: number;
  daysWorkedThisMonth: number;
}

export interface ExtractDay {
  workDate: string;
  weekday: string;
  /** "Hoje", "Ontem" ou nulo (mostra só o dia da semana/data). Calculado no servidor. */
  relativeLabel: "Hoje" | "Ontem" | null;
  entries: TimeEntry[];
  workedMinutes: number;
  balanceMinutes: number;
  expectedMinutes: number;
  hasRecord: boolean;
  openSession: boolean;
}

export interface TeamMemberStatus {
  profileId: string;
  fullName: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  squads: Squad[];
  isWorking: boolean;
  hasRecordToday: boolean;
  todayWorkedMinutes: number;
  monthBalanceMinutes: number;
}

export type { TimeBalanceSummaryRow, TimeDailySummaryRow };
