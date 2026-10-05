"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { centsToNumber, parseMoneyToCents, toCents } from "@/features/finance/money";
import {
  payableSchema,
  projectInstallmentsSchema,
  receivableSchema,
  settlePayableSchema,
  settleReceivableSchema,
  type PayableValues,
  type ProjectInstallmentsValues,
  type ReceivableValues,
  type SettlePayableValues,
  type SettleReceivableValues,
} from "@/features/finance/schemas";
import type { ActionResult } from "@/types";

const FORBIDDEN: ActionResult = { ok: false, error: "Você não tem permissão para esta ação." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const idSchema = z.string().uuid();

/** Exige a capability "finance" (não o papel). A RLS repete a regra no banco. */
async function requireFinance() {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "finance") ? profile : null;
}

function refresh() {
  revalidatePath("/financeiro");
  revalidatePath("/inicio");
  revalidatePath("/projetos", "layout");
  revalidatePath("/clientes", "layout");
}

const orNull = (value: string) => (value === "" ? null : value);
const amountToNumber = (input: string) => centsToNumber(parseMoneyToCents(input) ?? 0);

// ---------------------------------------------------------------------------
// Recebimentos
// ---------------------------------------------------------------------------

export async function createReceivableAction(values: ReceivableValues): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = receivableSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const data = parsed.data;
  const count = Number(data.installments);
  const supabase = await createClient();

  if (count > 1) {
    const { error } = await supabase.rpc("generate_installments", {
      // p_project_id não tem default no SQL (precisa ser enviado), mas aceita null — o tipo
      // gerado por `supabase gen types` para argumentos de função não carrega a nulidade.
      p_project_id: orNull(data.projectId) as string,
      p_total_amount: amountToNumber(data.amount),
      p_installments: count,
      p_first_due_date: data.dueDate,
      p_interval_days: Number(data.intervalDays),
      p_payment_method: data.paymentMethod === "" ? undefined : data.paymentMethod,
      p_company_id: data.companyId,
      p_description: data.description,
    });
    if (error) return { ok: false, error: friendlyError(error.message, "Não foi possível gerar as parcelas.") };
    refresh();
    return { ok: true, message: `${count} parcelas geradas.` };
  }

  const { error } = await supabase.from("receivables").insert({
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
  });
  if (error) return { ok: false, error: friendlyError(error.message, "Não foi possível criar o recebimento.") };
  refresh();
  return { ok: true, message: "Recebimento criado." };
}

export async function updateReceivableAction(id: string, values: ReceivableValues): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = receivableSchema.safeParse(values);
  if (!idSchema.safeParse(id).success || !parsed.success) return INVALID;
  const data = parsed.data;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("receivables")
    .update({
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
    })
    .eq("id", id)
    .is("received_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { ok: false, error: friendlyError(error.message, "Não foi possível salvar o recebimento.") };
  if (!updated || updated.length === 0) return { ok: false, error: "Só é possível editar recebimentos em aberto." };
  refresh();
  return { ok: true, message: "Recebimento atualizado." };
}

export async function settleReceivableAction(id: string, values: SettleReceivableValues): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = settleReceivableSchema.safeParse(values);
  if (!idSchema.safeParse(id).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("receivables")
    .update({
      received_at: parsed.data.receivedAt,
      received_amount: amountToNumber(parsed.data.receivedAmount),
      payment_method: parsed.data.paymentMethod,
      invoice_number: orNull(parsed.data.invoiceNumber),
    })
    .eq("id", id)
    .is("received_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível registrar o recebimento." };
  if (!updated || updated.length === 0) return { ok: false, error: "Este recebimento já foi baixado ou cancelado." };
  refresh();
  return { ok: true, message: "Recebimento registrado." };
}

export async function cancelReceivableAction(id: string): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("receivables")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .is("received_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível cancelar o recebimento." };
  if (!updated || updated.length === 0) return { ok: false, error: "Só é possível cancelar recebimentos em aberto." };
  refresh();
  return { ok: true, message: "Recebimento cancelado." };
}

/** Gera parcelas a partir do valor de contrato do projeto (lido do banco, não do cliente). */
export async function generateProjectInstallmentsAction(
  projectId: string,
  values: ProjectInstallmentsValues,
): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = projectInstallmentsSchema.safeParse(values);
  if (!idSchema.safeParse(projectId).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: financials } = await supabase.from("project_financials").select("contract_value").eq("project_id", projectId).maybeSingle();
  const contractCents = toCents(financials?.contract_value);
  if (contractCents <= 0) return { ok: false, error: "Defina o valor do contrato antes de gerar parcelas." };

  const { error } = await supabase.rpc("generate_installments", {
    p_project_id: projectId,
    p_total_amount: centsToNumber(contractCents),
    p_installments: Number(parsed.data.installments),
    p_first_due_date: parsed.data.firstDueDate,
    p_interval_days: Number(parsed.data.intervalDays),
    p_payment_method: parsed.data.paymentMethod === "" ? undefined : parsed.data.paymentMethod,
  });
  if (error) return { ok: false, error: friendlyError(error.message, "Não foi possível gerar as parcelas.") };
  refresh();
  return { ok: true, message: `${parsed.data.installments} parcelas geradas.` };
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

function toPayableRow(data: PayableValues) {
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
    recurrence: data.recurrence,
    recurrence_until: orNull(data.recurrenceUntil),
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

export async function createPayableAction(values: PayableValues): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = payableSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: inserted, error } = await supabase.from("payables").insert(toPayableRow(parsed.data)).select("id").single();
  if (error) return { ok: false, error: friendlyError(error.message, "Não foi possível criar o pagamento.") };

  if (parsed.data.recurrence !== "none" && inserted) {
    const { error: recurrenceError } = await supabase.rpc("generate_recurring_payables", { p_payable_id: inserted.id });
    if (recurrenceError) {
      refresh();
      return { ok: true, message: "Pagamento criado, mas as ocorrências futuras não puderam ser geradas." };
    }
  }
  refresh();
  return { ok: true, message: "Pagamento criado." };
}

export async function updatePayableAction(id: string, values: PayableValues): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = payableSchema.safeParse(values);
  if (!idSchema.safeParse(id).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("payables")
    .update(toPayableRow(parsed.data))
    .eq("id", id)
    .is("paid_at", null)
    .is("cancelled_at", null)
    .select("id, recurrence_parent_id");
  if (error) return { ok: false, error: friendlyError(error.message, "Não foi possível salvar o pagamento.") };
  if (!updated || updated.length === 0) return { ok: false, error: "Só é possível editar pagamentos em aberto." };

  const row = updated[0];
  if (row && parsed.data.recurrence !== "none" && !row.recurrence_parent_id) {
    await supabase.rpc("generate_recurring_payables", { p_payable_id: row.id });
  }
  refresh();
  return { ok: true, message: "Pagamento atualizado." };
}

export async function settlePayableAction(id: string, values: SettlePayableValues): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = settlePayableSchema.safeParse(values);
  if (!idSchema.safeParse(id).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("payables")
    .update({
      paid_at: parsed.data.paidAt,
      payment_method: parsed.data.paymentMethod,
      payment_receipt_url: orNull(parsed.data.receiptUrl),
      late_reason: parsed.data.paidAt > parsed.data.dueDate ? parsed.data.lateReason : null,
      penalty_amount: parsed.data.paidAt > parsed.data.dueDate && parsed.data.hadPenalty ? amountToNumber(parsed.data.penaltyAmount) : null,
      penalty_reason: parsed.data.paidAt > parsed.data.dueDate && parsed.data.hadPenalty ? parsed.data.penaltyReason : null,
    })
    .eq("id", id)
    .is("paid_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível registrar o pagamento." };
  if (!updated || updated.length === 0) return { ok: false, error: "Este pagamento já foi baixado ou cancelado." };
  refresh();
  return { ok: true, message: "Pagamento registrado." };
}

/** Agendar NÃO é pagar: o pagamento continua pendente/atrasado em todo total até a baixa. */
export async function schedulePayableAction(id: string, date: string | null): Promise<ActionResult> {
  const profile = await requireFinance();
  if (!profile) return FORBIDDEN;
  if (!idSchema.safeParse(id).success || (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return INVALID;
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("payables")
    .update({ scheduled_for: date, scheduled_at: date ? new Date().toISOString() : null, scheduled_by: date ? profile.id : null })
    .eq("id", id)
    .is("paid_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível agendar." };
  if (!updated || updated.length === 0) return { ok: false, error: "Este pagamento já foi baixado ou cancelado." };
  refresh();
  return { ok: true, message: date ? "Pagamento agendado. Ele continua em aberto até a baixa." : "Agendamento removido." };
}

/** Gera as pautas automáticas do financeiro (idempotente) — reforço do cron na abertura do painel. */
export async function generateFinanceAutoPautasAction(): Promise<void> {
  if (!(await requireFinance())) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("finance_generate_auto_pautas");
  } catch {
    // Sem a migração ou erro transitório: o cron das 8h gera de qualquer forma.
  }
}

export async function cancelPayableAction(id: string): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("payables")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .is("paid_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível cancelar o pagamento." };
  if (!updated || updated.length === 0) return { ok: false, error: "Só é possível cancelar pagamentos em aberto." };
  refresh();
  return { ok: true, message: "Pagamento cancelado." };
}

/** Mensagens das validações do banco (trigger/função) chegam em português; o resto vira texto genérico. */
function friendlyError(message: string, fallback: string) {
  const known = ["O projeto não pertence à empresa informada.", "Projetos internos não têm recebimentos."];
  return known.find((text) => message.includes(text)) ?? fallback;
}

/**
 * Varre recebimentos e pagamentos em atraso e notifica quem tem acesso ao financeiro.
 * Chamada a cada carregamento do painel (/inicio); sem cron. A própria função no banco
 * garante no máximo 1 notificação por item por dia (não há infra de agendamento aqui).
 */
export async function checkOverdueFinanceAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("notify_overdue_finance");
}

// ---------------------------------------------------------------------------
// Nota fiscal anexada (bucket privado "invoices")
// ---------------------------------------------------------------------------

const invoiceFilePath = z
  .string()
  .max(300)
  .regex(/^(receivables|issuances)\/[0-9a-f-]{36}\/[\w.-]+$/i, "Arquivo inválido.");

/** Número e arquivo da nota de um recebimento (vale também depois de recebido). */
export async function attachReceivableInvoiceAction(id: string, input: { invoiceNumber: string; filePath: string | null }): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = z
    .object({ invoiceNumber: z.string().trim().max(60), filePath: invoiceFilePath.nullable() })
    .safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return INVALID;
  if (parsed.data.filePath && !parsed.data.filePath.startsWith(`receivables/${id}/`)) return INVALID;

  const supabase = await createClient();
  const patch: { invoice_number: string | null; invoice_file_path?: string } = { invoice_number: parsed.data.invoiceNumber || null };
  if (parsed.data.filePath) patch.invoice_file_path = parsed.data.filePath;
  const { error } = await supabase.from("receivables").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar a nota fiscal." };
  refresh();
  return { ok: true, message: "Nota fiscal anexada ao recebimento." };
}

/** Link temporário (5 min) para baixar o arquivo da nota. A RLS do Storage decide quem pode. */
export async function getInvoiceFileUrlAction(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!invoiceFilePath.safeParse(path).success) return { ok: false, error: "Arquivo inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 300);
  if (error || !data) return { ok: false, error: "Não foi possível abrir a nota (sem acesso ou arquivo removido)." };
  return { ok: true, url: data.signedUrl };
}
