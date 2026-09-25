import type {
  CommitmentKind,
  CommitmentStatus,
  DealInteractionChannel,
  DealInteractionKind,
  DealLossReason,
  DealStage,
  DirectionTask,
  MeetingOutcome,
  ProposalChannel,
  ProposalStatus,
  ProspectionGoal,
  ReheatStatus,
} from "@/types";

export const DEAL_STAGES = [
  "prospeccao",
  "primeiro_contato",
  "tentativas_contato",
  "qualificado",
  "reuniao_agendada",
  "reuniao_realizada",
  "proposta_enviada",
  "negociacao",
  "ganho",
  "perdido",
] as const satisfies readonly DealStage[];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  prospeccao: "Prospecção",
  primeiro_contato: "Primeiro contato",
  tentativas_contato: "Tentativas de contato",
  qualificado: "Qualificado",
  reuniao_agendada: "Reunião agendada",
  reuniao_realizada: "Reunião realizada",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

/** Etapas em que o negócio está aberto (não fechado, ganho ou perdido). */
export const OPEN_DEAL_STAGES = DEAL_STAGES.filter((stage) => stage !== "ganho" && stage !== "perdido");

/** Etapas em que o negócio só chega já qualificado (espelha deals_guard_workflow no banco). */
export const STAGES_REQUIRING_QUALIFICATION: readonly DealStage[] = [
  "reuniao_agendada",
  "reuniao_realizada",
  "proposta_enviada",
  "negociacao",
  "ganho",
];

export const PROSPECTION_GOALS = [
  "recorrencia",
  "campanha_institucional",
  "cobertura_evento",
  "ativacao_marca",
  "producao_conteudo",
  "video_institucional",
  "outro",
] as const satisfies readonly ProspectionGoal[];

export const PROSPECTION_GOAL_LABELS: Record<ProspectionGoal, string> = {
  recorrencia: "Recorrência",
  campanha_institucional: "Campanha institucional",
  cobertura_evento: "Cobertura de evento",
  ativacao_marca: "Ativação de marca",
  producao_conteudo: "Produção de conteúdo",
  video_institucional: "Vídeo institucional",
  outro: "Outro",
};

export const DEAL_LOSS_REASONS = [
  "preco",
  "timing",
  "sem_resposta",
  "sem_fit",
  "concorrente",
  "orcamento_interno",
  "outro",
] as const satisfies readonly DealLossReason[];

export const DEAL_LOSS_REASON_LABELS: Record<DealLossReason, string> = {
  preco: "Preço",
  timing: "Timing",
  sem_resposta: "Sem resposta",
  sem_fit: "Sem fit",
  concorrente: "Concorrente",
  orcamento_interno: "Orçamento interno",
  outro: "Outro",
};

export const INTERACTION_KINDS = [
  "tentativa_contato",
  "resposta_cliente",
  "reuniao",
  "proposta",
  "negociacao",
  "direcionamento",
  "nota",
] as const satisfies readonly DealInteractionKind[];

export const INTERACTION_KIND_LABELS: Record<DealInteractionKind, string> = {
  tentativa_contato: "Tentativa de contato",
  resposta_cliente: "Resposta do cliente",
  reuniao: "Reunião",
  proposta: "Proposta",
  negociacao: "Negociação",
  direcionamento: "Direcionamento",
  nota: "Nota",
};

export const INTERACTION_CHANNELS = [
  "whatsapp",
  "ligacao",
  "email",
  "instagram",
  "linkedin",
  "presencial",
  "meet",
  "outro",
] as const satisfies readonly DealInteractionChannel[];

export const INTERACTION_CHANNEL_LABELS: Record<DealInteractionChannel, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  presencial: "Presencial",
  meet: "Meet",
  outro: "Outro",
};

export const MEETING_OUTCOMES = [
  "enviar_proposta",
  "fechado_na_call",
  "follow_up_sdr",
  "sem_interesse",
  "remarcar",
  "nao_compareceu",
] as const satisfies readonly MeetingOutcome[];

export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  enviar_proposta: "Enviar proposta",
  fechado_na_call: "Fechado na call",
  follow_up_sdr: "Follow-up com o SDR",
  sem_interesse: "Sem interesse",
  remarcar: "Remarcar",
  nao_compareceu: "Não compareceu",
};

export const MEETING_OUTCOME_HINTS: Record<MeetingOutcome, string> = {
  enviar_proposta: "A bola continua com você: você envia a proposta.",
  fechado_na_call: "Abre o fechamento do negócio em seguida.",
  follow_up_sdr: "O negócio volta para o SDR, com a sua nota.",
  sem_interesse: "O negócio volta para o SDR decidir o destino do lead.",
  remarcar: "Você continua com o negócio e informa a nova data.",
  nao_compareceu: "O negócio volta para o SDR remarcar.",
};

export const PROPOSAL_CHANNELS = [
  "whatsapp_pdf",
  "email",
  "ligacao",
  "meet",
  "presencial",
  "outro",
] as const satisfies readonly ProposalChannel[];

export const PROPOSAL_CHANNEL_LABELS: Record<ProposalChannel, string> = {
  whatsapp_pdf: "WhatsApp (PDF)",
  email: "E-mail",
  ligacao: "Ligação",
  meet: "Meet",
  presencial: "Presencial",
  outro: "Outro",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  enviada: "Enviada",
  em_negociacao: "Em negociação",
  aceita: "Aceita",
  recusada: "Recusada",
};

export const DIRECTION_TASKS = [
  "marcar_reuniao_ceo",
  "qualificar_melhor",
  "call_kickoff",
  "enviar_material",
  "aguardar_retorno",
  "descartar",
] as const satisfies readonly DirectionTask[];

export const DIRECTION_TASK_LABELS: Record<DirectionTask, string> = {
  marcar_reuniao_ceo: "Marcar reunião com o CEO",
  qualificar_melhor: "Qualificar melhor o lead",
  call_kickoff: "Fazer a call de kickoff",
  enviar_material: "Enviar material ao cliente",
  aguardar_retorno: "Aguardar retorno do cliente",
  descartar: "Descartar o lead",
};

export const REHEAT_STATUS_LABELS: Record<ReheatStatus, string> = {
  aguardando: "Aguardando 45 dias",
  notificado: "Pronto para decidir",
  em_reaquecimento: "Em reaquecimento",
  descartado: "Descartado",
};

export const COMMITMENT_KIND_LABELS: Record<CommitmentKind, string> = {
  reuniao_comercial: "Reunião comercial",
  captacao: "Captação",
  entrega: "Entrega",
  interno: "Interno",
};

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  agendado: "Agendado",
  realizado: "Realizado",
  nao_compareceu: "Não compareceu",
  remarcado: "Remarcado",
  cancelado: "Cancelado",
};

export type Temperature = "neutral" | "warning" | "danger";
export const TEMPERATURES = ["neutral", "warning", "danger"] as const satisfies readonly Temperature[];
export const TEMPERATURE_LABELS: Record<Temperature, string> = {
  neutral: "Em dia",
  warning: "Atenção",
  danger: "Crítico",
};

/** Etapa sugerida depois de "Cliente respondeu". */
export function suggestedStageAfterResponse(stage: DealStage): DealStage | null {
  if (stage === "prospeccao" || stage === "primeiro_contato" || stage === "tentativas_contato") return "qualificado";
  return null;
}
