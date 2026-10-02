import type { PautaCaptureType, PautaColumn, PautaStatus, Squad } from "@/types";

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
  "em_execucao",
  "aguardando_retorno",
  "aguardando_documento",
  "em_analise",
  "revisao_interna",
  "revisao_cliente",
  "reajuste",
  "aprovado",
] as const satisfies readonly PautaStatus[];

/** Rótulo genérico (filtros, histórico). Para a pauta em si, use pautaStatusLabel(status, squad). */
export const PAUTA_STATUS_LABELS: Record<PautaStatus, string> = {
  planejamento: "Planejamento",
  captacao: "Captação",
  edicao: "Edição",
  em_execucao: "Em execução",
  aguardando_retorno: "Aguardando retorno",
  aguardando_documento: "Aguardando documento",
  em_analise: "Em análise",
  revisao_interna: "Revisão interna",
  revisao_cliente: "Com o cliente",
  reajuste: "Ajuste",
  aprovado: "Aprovado",
};

/** Sequência de status de cada squad — espelha pauta_statuses_for() no banco. */
export const PAUTA_STATUSES_BY_SQUAD: Record<Squad, readonly PautaStatus[]> = {
  audiovisual: ["planejamento", "captacao", "edicao", "revisao_interna", "revisao_cliente", "reajuste", "aprovado"],
  comercial: ["planejamento", "em_execucao", "aguardando_retorno", "revisao_interna", "revisao_cliente", "reajuste", "aprovado"],
  financeiro: ["planejamento", "em_execucao", "aguardando_documento", "revisao_interna", "revisao_cliente", "reajuste", "aprovado"],
  diretoria: ["planejamento", "em_execucao", "em_analise", "revisao_interna", "revisao_cliente", "reajuste", "aprovado"],
};

export function statusesForSquad(squad: Squad | null | undefined): readonly PautaStatus[] {
  return PAUTA_STATUSES_BY_SQUAD[squad ?? "audiovisual"];
}

/** Rótulo do status no vocabulário do squad — espelha pauta_status_label() no banco. */
export function pautaStatusLabel(status: PautaStatus, squad: Squad | null | undefined): string {
  const production = (squad ?? "audiovisual") === "audiovisual";
  if (status === "planejamento") return production ? "Planejamento" : "A fazer";
  if (status === "aprovado") return production ? "Aprovado" : "Concluída";
  if (status === "revisao_interna") return squad === "financeiro" ? "Conferência" : "Revisão interna";
  return PAUTA_STATUS_LABELS[status];
}

/** "pauta" no audiovisual, "tarefa" nos outros squads. */
export function pautaNoun(squad: Squad | null | undefined): "pauta" | "tarefa" {
  return (squad ?? "audiovisual") === "audiovisual" ? "pauta" : "tarefa";
}

export const PAUTA_CAPTURE_TYPES = ["foto", "video"] as const satisfies readonly PautaCaptureType[];

export const PAUTA_CAPTURE_TYPE_LABELS: Record<PautaCaptureType, string> = {
  foto: "Foto",
  video: "Vídeo",
};

export function columnForStatus(status: PautaStatus): PautaColumn {
  switch (status) {
    case "planejamento":
      return "sprint_backlog";
    case "revisao_interna":
    case "revisao_cliente":
      return "revisao";
    case "aprovado":
      return "entregue";
    default:
      return "em_andamento";
  }
}

/** Espelha pauta_default_status() do banco: status sugerido ao arrastar o card para uma coluna. */
export function defaultStatusForColumn(column: PautaColumn, previousStatus?: PautaStatus, squad?: Squad | null): PautaStatus {
  switch (column) {
    case "sprint_backlog":
      return "planejamento";
    case "revisao":
      return "revisao_interna";
    case "entregue":
      return "aprovado";
    case "em_andamento": {
      if (previousStatus && (["revisao_interna", "revisao_cliente", "aprovado"] as PautaStatus[]).includes(previousStatus)) return "reajuste";
      if ((squad ?? "audiovisual") === "audiovisual") return previousStatus === "edicao" || previousStatus === "reajuste" ? "edicao" : "captacao";
      if (previousStatus && statusesForSquad(squad).includes(previousStatus) && columnForStatus(previousStatus) === "em_andamento") return previousStatus;
      return "em_execucao";
    }
  }
}

/** Status do squad que caem numa coluna (para o "passar adiante" aberto ao arrastar). */
export function statusesInColumn(column: PautaColumn, squad: Squad | null | undefined): PautaStatus[] {
  return statusesForSquad(squad).filter((status) => columnForStatus(status) === column);
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
