import type {
  BankAccountType,
  GoalCommissionMode,
  GoalEntrySource,
  GoalEntryStatus,
  GoalMetric,
  GoalStatus,
  PaymentMethod,
  PixKeyType,
} from "@/types";
import type { StatusTone } from "@/lib/status";

export const GOAL_METRICS = [
  "vendas_valor",
  "vendas_quantidade",
  "reunioes_agendadas",
  "reunioes_realizadas",
  "novos_negocios",
  "personalizada",
] as const satisfies readonly GoalMetric[];

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  vendas_valor: "Vendas (R$)",
  vendas_quantidade: "Vendas fechadas (quantidade)",
  reunioes_agendadas: "Reuniões agendadas",
  reunioes_realizadas: "Reuniões realizadas",
  novos_negocios: "Negócios novos no CRM",
  personalizada: "Personalizada",
};

/** Unidade no plural, para "12 de 40 reuniões". Personalizada usa unit_label. */
export const GOAL_METRIC_UNITS: Record<GoalMetric, string> = {
  vendas_valor: "",
  vendas_quantidade: "vendas",
  reunioes_agendadas: "reuniões",
  reunioes_realizadas: "reuniões",
  novos_negocios: "negócios",
  personalizada: "",
};

/** Métricas que o CRM consegue alimentar sozinho. */
export const CRM_METRICS: readonly GoalMetric[] = ["vendas_valor", "vendas_quantidade", "reunioes_agendadas", "reunioes_realizadas", "novos_negocios"];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  ativa: "Ativa",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
};

export const GOAL_STATUS_TONE: Record<GoalStatus, StatusTone> = {
  ativa: "success",
  em_revisao: "warning",
  aprovada: "neutral",
  cancelada: "neutral",
};

export const COMMISSION_MODE_LABELS: Record<GoalCommissionMode, string> = {
  percentual: "% sobre o valor atingido",
  por_unidade: "R$ por unidade atingida",
};

export const ENTRY_STATUS_LABELS: Record<GoalEntryStatus, string> = {
  pendente: "A confirmar",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const ENTRY_STATUS_TONE: Record<GoalEntryStatus, StatusTone> = {
  pendente: "warning",
  aprovado: "success",
  recusado: "danger",
};

export const ENTRY_SOURCE_LABELS: Record<GoalEntrySource, string> = { manual: "Lançado", crm: "CRM" };

export const GOAL_TABS = ["ativas", "encerradas"] as const;
export type GoalTab = (typeof GOAL_TABS)[number];
export const GOAL_TAB_LABELS: Record<GoalTab, string> = { ativas: "Em andamento", encerradas: "Encerradas" };

export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const satisfies readonly PixKeyType[];
export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

export const BANK_ACCOUNT_TYPES = ["corrente", "poupanca", "pagamento"] as const satisfies readonly BankAccountType[];
export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  pagamento: "Conta de pagamento",
};

export const PAYOUT_METHODS = ["pix", "transferencia"] as const satisfies readonly PaymentMethod[];

/**
 * Meta com o progresso já em centésimos inteiros (centavos para dinheiro; centésimos de unidade
 * para quantidades) — nenhuma conta usa ponto flutuante.
 */
export interface GoalItem {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  metric: GoalMetric;
  unitLabel: string | null;
  isMoney: boolean;
  target: number;
  startsOn: string;
  endsOn: string;
  commissionMode: GoalCommissionMode;
  /** percentual: 0–100. por_unidade: centavos por unidade. */
  commissionRate: number;
  minAchievementPct: number;
  autoFromCrm: boolean;
  status: GoalStatus;
  approved: number;
  pending: number;
  pendingCount: number;
  commissionConfirmed: number;
  commissionPotential: number;
  approvedAt: string | null;
  finalAchieved: number | null;
  finalCommission: number | null;
  payableId: string | null;
}

export interface GoalEntryItem {
  id: string;
  goalId: string;
  amount: number;
  entryDate: string;
  note: string | null;
  linkUrl: string | null;
  dealId: string | null;
  source: GoalEntrySource;
  status: GoalEntryStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PaymentDetailsItem {
  preferredMethod: PaymentMethod;
  holderName: string | null;
  holderDocument: string | null;
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
  bankName: string | null;
  bankCode: string | null;
  agency: string | null;
  accountNumber: string | null;
  accountType: BankAccountType | null;
  notes: string | null;
  updatedAt: string;
}
