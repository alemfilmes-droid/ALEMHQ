import type { ClientHealth, CommitmentKind, CommitmentStatus, DealStage, MeetingOutcome, MarginStatus, PautaColumn, PautaStatus, ProjectStage, Squad } from "@/types";

/**
 * Única fonte da paleta semântica de status. As cores vêm de variáveis CSS
 * (app/globals.css) e só podem aparecer como indicadores pequenos — nunca
 * como fundo de botão, card ou área de gráfico. "neutral" não tem cor: usa
 * cinza da marca.
 */
export type StatusTone = "success" | "warning" | "alert" | "danger" | "neutral";

export const STATUS_TONE_VAR: Record<Exclude<StatusTone, "neutral">, string> = {
  success: "var(--status-success)",
  warning: "var(--status-warning)",
  alert: "var(--status-alert)",
  danger: "var(--status-danger)",
};

export const STATUS_TONE_LABEL: Record<StatusTone, string> = {
  success: "Saudável",
  warning: "Atenção",
  alert: "Alerta",
  danger: "Crítico",
  neutral: "Neutro",
};

export const CLIENT_HEALTH_TONE: Record<ClientHealth, StatusTone> = {
  ativo: "success",
  atencao: "warning",
  tensao: "alert",
  churn: "danger",
};

export const CLIENT_HEALTH_LABELS: Record<ClientHealth, string> = {
  ativo: "Ativo",
  atencao: "Atenção",
  tensao: "Tensão",
  churn: "Churn",
};

export const PROJECT_STAGE_TONE: Record<ProjectStage, StatusTone> = {
  planejamento: "neutral",
  pre_producao: "neutral",
  captacao: "warning",
  producao: "warning",
  edicao: "warning",
  revisao_interna: "neutral",
  aprovacao_cliente: "alert",
  alteracao: "alert",
  entregue: "success",
  pausado: "danger",
  cancelado: "danger",
};

export const SQUAD_TONE: Record<Squad, StatusTone> = {
  diretoria: "danger",
  audiovisual: "warning",
  financeiro: "success",
  comercial: "alert",
};

export const PAUTA_COLUMN_TONE: Record<PautaColumn, StatusTone> = {
  sprint_backlog: "neutral",
  em_andamento: "warning",
  revisao: "alert",
  entregue: "success",
};

export const PAUTA_STATUS_TONE: Record<PautaStatus, StatusTone> = {
  planejamento: "neutral",
  captacao: "warning",
  edicao: "warning",
  revisao_interna: "alert",
  revisao_cliente: "alert",
  reajuste: "danger",
  aprovado: "success",
};

export const DEAL_STAGE_TONE: Record<DealStage, StatusTone> = {
  prospeccao: "neutral",
  primeiro_contato: "neutral",
  tentativas_contato: "neutral",
  qualificado: "neutral",
  reuniao_agendada: "warning",
  reuniao_realizada: "warning",
  proposta_enviada: "warning",
  negociacao: "warning",
  ganho: "success",
  perdido: "danger",
};

export const MEETING_OUTCOME_TONE: Record<MeetingOutcome, StatusTone> = {
  enviar_proposta: "success",
  fechado_na_call: "success",
  follow_up_sdr: "warning",
  remarcar: "warning",
  sem_interesse: "danger",
  nao_compareceu: "danger",
};

export const COMMITMENT_STATUS_TONE: Record<CommitmentStatus, StatusTone> = {
  agendado: "neutral",
  realizado: "success",
  nao_compareceu: "danger",
  remarcado: "warning",
  cancelado: "danger",
};

/** Temperatura do negócio (SLA): só um indicador pequeno no card — nunca cor de fundo. */
export const TEMPERATURE_TONE: Record<"neutral" | "warning" | "danger", StatusTone> = {
  neutral: "neutral",
  warning: "warning",
  danger: "danger",
};

export const MARGIN_STATUS_TONE: Record<MarginStatus, StatusTone> = {
  saudavel: "success",
  atencao: "warning",
  critico: "danger",
};

export const MARGIN_STATUS_LABELS: Record<MarginStatus, string> = {
  saudavel: "saudável",
  atencao: "abaixo do saudável",
  critico: "crítica",
};

export function toneColor(tone: StatusTone): string | undefined {
  return tone === "neutral" ? undefined : STATUS_TONE_VAR[tone];
}

/** Tipo de compromisso na agenda: só a barra de 3px do bloco leva cor — nunca o bloco inteiro. */
export const COMMITMENT_KIND_TONE: Record<CommitmentKind, StatusTone> = {
  reuniao_comercial: "alert",
  captacao: "warning",
  entrega: "success",
  interno: "neutral",
};

/**
 * Cor do ícone de cada painel, DENTRO da página (bloco do cabeçalho) — a do squad dono do módulo.
 * A navegação lateral continua monocromática. Rotas fora daqui (Início, Agenda, Equipe, Avisos,
 * Banco de Horas, Configurações) são neutras.
 */
export const PANEL_TONE: Partial<Record<string, StatusTone>> = {
  "/crm": SQUAD_TONE.comercial,
  "/financeiro": SQUAD_TONE.financeiro,
  "/pautas": SQUAD_TONE.audiovisual,
  "/minhas-pautas": SQUAD_TONE.audiovisual,
  "/projetos": SQUAD_TONE.audiovisual,
  "/clientes": SQUAD_TONE.audiovisual,
};

/** Contorno tingido de baixa opacidade (sobre a borda neutra) — o fundo continua neutro. */
export function toneBorder(tone: StatusTone, percent = 35): string | undefined {
  const color = toneColor(tone);
  return color ? `color-mix(in srgb, ${color} ${percent}%, var(--border))` : undefined;
}

/**
 * Degradê muito leve da esquerda para a direita, tingido pela cor do squad, sobre a superfície
 * neutra do card — identifica a origem sem virar fundo colorido. O texto continua em alto contraste.
 */
export function toneGradient(tone: StatusTone, percent = 10): string | undefined {
  const color = toneColor(tone);
  return color ? `linear-gradient(90deg, color-mix(in srgb, ${color} ${percent}%, transparent) 0%, transparent 65%)` : undefined;
}
