import type { PayableCategory, PayableRecurrence, PaymentMethod } from "@/types";

export const PAYMENT_METHODS = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"] as const satisfies readonly PaymentMethod[];

export const PAYABLE_CATEGORIES = [
  "freelancer",
  "equipamento",
  "locacao",
  "deslocamento",
  "hospedagem",
  "alimentacao",
  "trilha_licenca",
  "software",
  "imposto",
  "marketing",
  "outro",
] as const satisfies readonly PayableCategory[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  transferencia: "Transferência",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, string> = {
  freelancer: "Freelancer",
  equipamento: "Equipamento",
  locacao: "Locação",
  deslocamento: "Deslocamento",
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  trilha_licenca: "Trilha e licença",
  software: "Software",
  imposto: "Imposto",
  marketing: "Marketing",
  outro: "Outro",
};

export const PAYABLE_RECURRENCES = ["none", "mensal", "trimestral", "anual"] as const satisfies readonly PayableRecurrence[];

export const PAYABLE_RECURRENCE_LABELS: Record<PayableRecurrence, string> = {
  none: "Não recorrente",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

export const FIXED_VARIABLE_LABELS = { fixed: "Fixo", variable: "Variável" } as const;

/** Combinações prontas do filtro "Tipo de custo" (Filtros do Pagamentos e atalho rápido). */
export const PAYABLE_COST_TYPE_FILTERS = ["fixo_empresa", "variavel", "projeto", "sem_projeto"] as const;
export type PayableCostTypeFilter = (typeof PAYABLE_COST_TYPE_FILTERS)[number];

export const PAYABLE_COST_TYPE_FILTER_LABELS: Record<PayableCostTypeFilter, string> = {
  fixo_empresa: "Custos fixos da empresa",
  variavel: "Custos variáveis",
  projeto: "Custos de projeto",
  sem_projeto: "Custos sem projeto",
};

export const STATUS_LABELS = {
  pendente: "Pendente",
  atrasado: "Atrasado",
  recebido: "Recebido",
  pago: "Pago",
  cancelado: "Cancelado",
} as const;
