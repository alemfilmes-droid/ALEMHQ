import { centsToNumber, parseMoneyToCents } from "@/features/finance/money";
import type { PayableValues, ReceivableValues, SettledPayableValues, SettledReceivableValues } from "@/features/finance/schemas";

/** Formulário → colunas do banco. Compartilhado por criar, editar e editar lançamento já baixado. */

export const orNull = (value: string) => (value === "" ? null : value);
export const amountToNumber = (input: string) => centsToNumber(parseMoneyToCents(input) ?? 0);

/** Campos do próprio lançamento (sem a recorrência, que é da série). */
function payableFields(data: Omit<PayableValues, "recurrence" | "recurrenceUntil">) {
  return {
    // "Custo da empresa" nunca carrega projeto, mesmo que o campo tenha ficado com um valor
    // de uma seleção anterior — o tipo de custo escolhido é que manda, não o campo em si.
    project_id: data.costType === "empresa" ? null : orNull(data.projectId),
    company_id: orNull(data.companyId),
    payee_profile_id: orNull(data.payeeProfileId),
    // Favorecido membro da equipe: o nome vem do profile.
    payee_name: data.payeeProfileId ? null : orNull(data.payeeName),
    category: data.category,
    description: data.description,
    amount: amountToNumber(data.amount),
    due_date: data.dueDate,
    payment_method: data.paymentMethod === "" ? null : data.paymentMethod,
    notes: orNull(data.notes),
    is_fixed: data.isFixed,
    // Favorecido da equipe: os dados vêm do perfil (payment_details) — nada duplicado aqui.
    payee_pix_key_type: data.payeeProfileId || data.payeePixKeyType === "" ? null : data.payeePixKeyType,
    payee_pix_key: data.payeeProfileId ? null : orNull(data.payeePixKey),
    payee_holder_name: data.payeeProfileId ? null : orNull(data.payeeHolderName),
    payee_document: data.payeeProfileId ? null : orNull(data.payeeDocument),
    payee_bank_name: data.payeeProfileId ? null : orNull(data.payeeBankName),
    payee_bank_agency: data.payeeProfileId ? null : orNull(data.payeeBankAgency),
    payee_bank_account: data.payeeProfileId ? null : orNull(data.payeeBankAccount),
    payee_account_type: data.payeeProfileId || data.payeeAccountType === "" ? null : data.payeeAccountType,
  };
}

export function toPayableRow(data: PayableValues) {
  return { ...payableFields(data), recurrence: data.recurrence, recurrence_until: orNull(data.recurrenceUntil) };
}

export function toReceivableRow(data: Omit<ReceivableValues, "installments" | "intervalDays">) {
  return {
    company_id: data.companyId,
    project_id: orNull(data.projectId),
    description: data.description,
    service_description: orNull(data.serviceDescription),
    competence_month: orNull(data.competenceMonth),
    amount: amountToNumber(data.amount),
    due_date: data.dueDate,
    payment_method: data.paymentMethod === "" ? null : data.paymentMethod,
    invoice_number: orNull(data.invoiceNumber),
    notes: orNull(data.notes),
    requires_invoice: data.requiresInvoice,
  };
}

/** Lançamento já baixado: todos os campos do pagamento (sem a recorrência, que é da série) + a baixa. */
export function settledPayablePatch(data: SettledPayableValues) {
  return {
    ...payableFields(data),
    paid_at: data.paidAt,
    payment_method: data.paymentMethod,
    payment_receipt_url: orNull(data.receiptUrl),
    late_reason: data.paidAt > data.dueDate ? data.lateReason : null,
    penalty_amount: data.penaltyAmount === "" ? null : amountToNumber(data.penaltyAmount),
    penalty_reason: data.penaltyAmount === "" ? null : orNull(data.penaltyReason),
  };
}

export function settledReceivablePatch(data: SettledReceivableValues) {
  return {
    ...toReceivableRow(data),
    payment_method: data.paymentMethod,
    received_at: data.receivedAt,
    received_amount: amountToNumber(data.receivedAmount),
  };
}
