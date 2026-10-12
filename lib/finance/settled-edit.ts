import { PAYABLE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/features/finance/labels";
import { formatCents, toCents } from "@/features/finance/money";
import { BANK_ACCOUNT_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from "@/features/goals/types";
import { formatDateShort } from "@/lib/format";
import type { BankAccountType, PayableCategory, PaymentMethod, PixKeyType, Squad } from "@/types";

/**
 * Edição de lançamento já baixado e estorno. As regras valem no banco (finance_edit_settled /
 * finance_reverse_settlement); aqui ficam os espelhos usados pela tela (motivo inline, histórico).
 */

export type FinanceEntryType = "payable" | "receivable";

/** Código do banco quando outra pessoa alterou o lançamento depois que a tela o abriu. */
export const SETTLED_CONFLICT_CODE = "HQ409";

/** Espelho de finance_settled_fields() no banco. */
export const SETTLED_FIELDS: Record<FinanceEntryType, readonly string[]> = {
  payable: [
    "description", "category", "is_fixed", "company_id", "project_id", "payee_profile_id", "payee_name",
    "payee_pix_key_type", "payee_pix_key", "payee_holder_name", "payee_document", "payee_bank_name",
    "payee_bank_agency", "payee_bank_account", "payee_account_type", "amount", "due_date", "notes",
    "paid_at", "payment_method", "payment_receipt_url", "late_reason", "penalty_amount", "penalty_reason",
  ],
  receivable: [
    "company_id", "project_id", "description", "service_description", "competence_month", "amount",
    "due_date", "payment_method", "invoice_number", "notes", "received_at", "received_amount",
  ],
};

/** Espelho de finance_reason_fields(): mudou valor ou data de pagamento → motivo obrigatório. */
export const REASON_FIELDS: Record<FinanceEntryType, readonly string[]> = {
  payable: ["amount", "paid_at"],
  receivable: ["amount", "received_amount", "received_at"],
};

export type FieldChange = { before: unknown; after: unknown };
export type EntryChanges = Record<string, FieldChange>;

/** Diretoria e squad financeiro (a marca manual "acesso ao financeiro" só vê). Espelho de can_see_money(). */
export function canEditSettled(squads: readonly Squad[]): boolean {
  return squads.includes("diretoria") || squads.includes("financeiro");
}

function normalize(value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  return value;
}

/** Diferença campo a campo (só os campos editáveis), com a mesma comparação do banco. */
export function diffEntry(type: FinanceEntryType, before: Record<string, unknown>, after: Record<string, unknown>): EntryChanges {
  const changes: EntryChanges = {};
  for (const field of SETTLED_FIELDS[type]) {
    if (!(field in after)) continue;
    const previous = normalize(before[field]);
    const next = normalize(after[field]);
    if (previous !== next) changes[field] = { before: previous, after: next };
  }
  return changes;
}

export function needsReason(type: FinanceEntryType, changes: EntryChanges): boolean {
  return REASON_FIELDS[type].some((field) => field in changes);
}

// ---------------------------------------------------------------------------
// Histórico de alterações: "Campo: antes → depois"
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  description: "Descrição",
  category: "Categoria",
  is_fixed: "Custo fixo",
  company_id: "Cliente",
  project_id: "Projeto",
  payee_profile_id: "Favorecido (equipe)",
  payee_name: "Favorecido",
  payee_pix_key_type: "Tipo da chave Pix",
  payee_pix_key: "Chave Pix",
  payee_holder_name: "Titular",
  payee_document: "CPF/CNPJ",
  payee_bank_name: "Banco",
  payee_bank_agency: "Agência",
  payee_bank_account: "Conta",
  payee_account_type: "Tipo de conta",
  amount: "Valor",
  due_date: "Vencimento",
  notes: "Observações",
  paid_at: "Data do pagamento",
  payment_method: "Forma de pagamento",
  payment_receipt_url: "Comprovante",
  late_reason: "Motivo do atraso",
  penalty_amount: "Multa/juros",
  penalty_reason: "Motivo da multa/juros",
  paid_late: "Pago com atraso",
  original_amount: "Valor original",
  service_description: "Descrição do serviço",
  competence_month: "Mês de competência",
  invoice_number: "Nota fiscal",
  invoice_file_path: "Arquivo da nota",
  received_at: "Data do recebimento",
  received_amount: "Valor recebido",
};

const MONEY_FIELDS = new Set(["amount", "penalty_amount", "original_amount", "received_amount"]);
const DATE_FIELDS = new Set(["due_date", "paid_at", "received_at", "competence_month"]);

export function historyFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Nomes de cliente, projeto e pessoa por id (a tela já tem essas listas). */
export type NameLookup = (field: "company_id" | "project_id" | "payee_profile_id", id: string) => string | undefined;

export function formatHistoryValue(field: string, value: unknown, lookup?: NameLookup): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (MONEY_FIELDS.has(field) && (typeof value === "number" || typeof value === "string")) return formatCents(toCents(Number(value)));
  if (typeof value !== "string") return String(value);
  if (DATE_FIELDS.has(field)) return formatDateShort(value.slice(0, 10));
  if (field === "invoice_file_path") return "arquivo anexado";
  if (field === "company_id" || field === "project_id" || field === "payee_profile_id") return lookup?.(field, value) ?? "(removido)";
  if (field === "category") return PAYABLE_CATEGORY_LABELS[value as PayableCategory] ?? value;
  if (field === "payment_method") return PAYMENT_METHOD_LABELS[value as PaymentMethod] ?? value;
  if (field === "payee_pix_key_type") return PIX_KEY_TYPE_LABELS[value as PixKeyType] ?? value;
  if (field === "payee_account_type") return BANK_ACCOUNT_TYPE_LABELS[value as BankAccountType] ?? value;
  return value;
}

/** Regras do banco (motivo, conflito, permissão, cancelado) vão direto; erro técnico vira texto simples. */
export function settledDbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code && [SETTLED_CONFLICT_CODE, "22023", "42501", "P0002"].includes(error.code)) return error.message;
  if (error.code === "23514") return "Algum campo está fora do formato aceito. Revise e tente de novo.";
  if (error.code === "22P02") return "Algum valor é inválido. Revise e tente de novo.";
  if (error.code === "23503") return "O cliente, projeto ou pessoa escolhida não existe mais.";
  return "Não foi possível salvar. Nada foi alterado: tente de novo.";
}

/** Conflito de edição (outra pessoa salvou antes): a tela oferece "Recarregar o HQ". */
export function isConflictMessage(message: string): boolean {
  return message.startsWith("Este lançamento foi alterado por");
}
