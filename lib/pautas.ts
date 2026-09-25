import type { PautaCaptureType, PautaColumn, PautaStatus } from "@/types";

export const PAUTA_COLUMNS = ["sprint_backlog", "em_andamento", "revisao", "entregue"] as const satisfies readonly PautaColumn[];

export const PAUTA_COLUMN_LABELS: Record<PautaColumn, string> = {
  sprint_backlog: "Sprint Backlog",
  em_andamento: "Em andamento",
  revisao: "Revisão",
  entregue: "Entregue",
};

export const PAUTA_STATUSES = [
  "planejamento",
  "captacao",
  "edicao",
  "revisao_interna",
  "revisao_cliente",
  "reajuste",
  "aprovado",
] as const satisfies readonly PautaStatus[];

export const PAUTA_STATUS_LABELS: Record<PautaStatus, string> = {
  planejamento: "Planejamento",
  captacao: "Captação",
  edicao: "Edição",
  revisao_interna: "Revisão interna",
  revisao_cliente: "Revisão do cliente",
  reajuste: "Reajuste",
  aprovado: "Aprovado",
};

export const PAUTA_CAPTURE_TYPES = ["foto", "video"] as const satisfies readonly PautaCaptureType[];

export const PAUTA_CAPTURE_TYPE_LABELS: Record<PautaCaptureType, string> = {
  foto: "Foto",
  video: "Vídeo",
};

/**
 * Espelha o trigger `pautas_sync_column_status` do banco — só para a prévia otimista da UI ao
 * arrastar um card. O banco é sempre a fonte de verdade; se divergir, o refetch corrige.
 */
export function defaultStatusForColumn(column: PautaColumn, previousStatus?: PautaStatus): PautaStatus {
  switch (column) {
    case "sprint_backlog":
      return "planejamento";
    case "em_andamento":
      return previousStatus && (["edicao", "revisao_interna", "revisao_cliente", "reajuste", "aprovado"] as PautaStatus[]).includes(previousStatus)
        ? "edicao"
        : "captacao";
    case "revisao":
      return "revisao_interna";
    case "entregue":
      return "aprovado";
  }
}

export function columnForStatus(status: PautaStatus): PautaColumn {
  switch (status) {
    case "planejamento":
      return "sprint_backlog";
    case "captacao":
    case "edicao":
    case "reajuste":
      return "em_andamento";
    case "revisao_interna":
    case "revisao_cliente":
      return "revisao";
    case "aprovado":
      return "entregue";
  }
}

/** Estágios "depois da captação" — usados para decidir o status padrão ao voltar para Em andamento. */
export const STATUSES_PAST_CAPTURE: readonly PautaStatus[] = ["edicao", "revisao_interna", "revisao_cliente", "reajuste", "aprovado"];

/** Hoje em America/Fortaleza (yyyy-mm-dd), para comparar com due_date sem depender do fuso do servidor. */
export function todayInFortaleza(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
}

export function isPautaOverdue(dueDate: string | null, column: PautaColumn): boolean {
  return dueDate !== null && column !== "entregue" && dueDate < todayInFortaleza();
}

export function isPautaDueSoon(dueDate: string | null, column: PautaColumn, hours = 24): boolean {
  if (!dueDate || column === "entregue") return false;
  const limit = new Date();
  limit.setHours(limit.getHours() + hours);
  return new Date(`${dueDate}T23:59:59`) <= limit && !isPautaOverdue(dueDate, column);
}

/** yyyy-mm-dd (sem fuso) → meio-dia UTC do mesmo dia calendário, para operar com setUTCDate() sem risco de virar o dia. */
export function dateOnlyToUtcNoon(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/** Domingo (yyyy-mm-dd) da semana corrente em America/Fortaleza — início do intervalo "Esta semana". */
export function endOfWeekInFortaleza(): string {
  const asUtc = dateOnlyToUtcNoon(todayInFortaleza());
  const daysUntilSunday = 6 - asUtc.getUTCDay(); // getUTCDay: domingo = 0
  asUtc.setUTCDate(asUtc.getUTCDate() + daysUntilSunday);
  return asUtc.toISOString().slice(0, 10);
}

export type PautaUrgency = "atrasada" | "hoje" | "esta_semana" | "depois" | "sem_prazo";

/** Grupo de urgência do quadro pessoal, a partir do prazo (due_date) — não depende da coluna do quadro. */
export function pautaUrgency(dueDate: string | null): PautaUrgency {
  if (!dueDate) return "sem_prazo";
  const today = todayInFortaleza();
  if (dueDate < today) return "atrasada";
  if (dueDate === today) return "hoje";
  if (dueDate <= endOfWeekInFortaleza()) return "esta_semana";
  return "depois";
}
