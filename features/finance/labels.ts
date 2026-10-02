import type { PayableCategory, PayableRecurrence, PaymentMethod } from "@/types";

export const PAYMENT_METHODS = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"] as const satisfies readonly PaymentMethod[];

export const PAYABLE_CATEGORIES = [
  "pessoal",
  "comissao",
  "pro_labore",
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
  "estrutura",
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
  pessoal: "Pessoal/Equipe",
  comissao: "Comissão",
  pro_labore: "Pró-labore",
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
  estrutura: "Estrutura",
  outro: "Outro",
};

/**
 * Grupos da aba "Custos da empresa": cada categoria de pagamento cai em um grupo. Equipe junta
 * colaboradores (Pessoal/Equipe) e freelancers; Estrutura junta aluguel/locação, equipamento e a
 * própria categoria Estrutura.
 */
export const COMPANY_COST_GROUPS = ["equipe", "software", "estrutura", "impostos", "marketing", "outros"] as const;
export type CompanyCostGroup = (typeof COMPANY_COST_GROUPS)[number];

export const COMPANY_COST_GROUP_LABELS: Record<CompanyCostGroup, string> = {
  equipe: "Equipe e colaboradores",
  software: "Software",
  estrutura: "Estrutura",
  impostos: "Impostos",
  marketing: "Marketing",
  outros: "Outros",
};

export const COMPANY_COST_GROUP_OF: Record<PayableCategory, CompanyCostGroup> = {
  pessoal: "equipe",
  comissao: "equipe",
  pro_labore: "equipe",
  freelancer: "equipe",
  software: "software",
  estrutura: "estrutura",
  locacao: "estrutura",
  equipamento: "estrutura",
  imposto: "impostos",
  marketing: "marketing",
  deslocamento: "outros",
  hospedagem: "outros",
  alimentacao: "outros",
  trilha_licenca: "outros",
  outro: "outros",
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
