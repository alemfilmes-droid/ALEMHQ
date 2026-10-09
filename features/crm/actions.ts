"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealDetail } from "@/features/crm/queries";
import {
  clientResponseSchema,
  commissionRuleSchema,
  contactSchema,
  dateOnlyToFortalezaTimestamp,
  dealSchema,
  directionSchema,
  lossSchema,
  meetingSchema,
  negotiationSchema,
  outcomeSchema,
  proposalSchema,
  qualificationSchema,
  reassignOwnerSchema,
  reheatSchema,
  stageChangeSchema,
  stageProbabilitySchema,
  updateDealSchema,
  wonSchema,
  type ClientResponseValues,
  type CommissionRuleValues,
  type ContactValues,
  type DealValues,
  type DirectionValues,
  type LossValues,
  type MeetingValues,
  type NegotiationValues,
  type OutcomeValues,
  type ProposalValues,
  type QualificationValues,
  type ReassignOwnerValues,
  type ReheatValues,
  type StageChangeValues,
  type StageProbabilityValues,
  type UpdateDealValues,
  type WonValues,
} from "@/features/crm/schemas";
import type { DealDetail } from "@/features/crm/types";
import { centsToNumber, parseMoneyToCents } from "@/features/finance/money";
import { canManageAllDeals, hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { nullIfEmpty } from "@/lib/validations/company";
import { createClient } from "@/lib/supabase/server";
import type { CompanyLifecycle, Tables } from "@/types";

/** Pré-requisitos do fluxo que o banco recusou — a UI usa para explicar e oferecer o próximo passo. */
export type FlowNeed = "qualification" | "meeting" | "proposal" | "client_response" | "outcome" | "interaction";

export type FlowResult =
  | { ok: true; message?: string; id?: string; projectId?: string }
  | { ok: false; error: string; needs?: FlowNeed };

const FORBIDDEN: FlowResult = { ok: false, error: "Você não tem permissão para esta ação." };
const INVALID: FlowResult = { ok: false, error: "Revise os campos e tente novamente." };
const UNAUTHENTICATED: FlowResult = { ok: false, error: "Sessão expirada. Entre novamente." };
const idSchema = z.string().uuid();

function refresh() {
  revalidatePath("/crm");
  revalidatePath("/inicio");
  revalidatePath("/minhas-pautas");
  revalidatePath("/financeiro");
  revalidatePath("/clientes", "layout");
}

/**
 * Argumentos de função sem DEFAULT no SQL vêm tipados como não-nulos pelo `supabase gen types`, mesmo
 * quando a função aceita null — este helper concentra o cast (mesmo motivo do `as string` em
 * features/finance/actions.ts).
 */
function arg<T>(value: T | null | undefined): T {
  return value as T;
}

const orNull = (value: string) => (value === "" ? null : value);
const moneyOrNull = (value: string) => {
  const cents = parseMoneyToCents(value);
  return cents === null ? null : centsToNumber(cents);
};

function nextActionAt(date: string, time: string) {
  return dateOnlyToFortalezaTimestamp(date, time);
}

const NEEDS: [string, FlowNeed][] = [
  ["Qualifique", "qualification"],
  ["Agende a reunião", "meeting"],
  ["Registre a proposta", "proposal"],
  ["cliente responder", "client_response"],
  ["resultado da reunião", "outcome"],
  ["Registre o contato realizado", "interaction"],
];

/** Mensagens das validações do banco (trigger/função) já vêm em português; o resto vira texto genérico. */
function dbFailure(error: { code?: string; message: string }, fallback: string): FlowResult {
  const known = ["23514", "42501", "22023", "P0001"].includes(error.code ?? "");
  const technical = /^(new row|permission denied|duplicate key|insert or update)/i.test(error.message);
  if (!known || technical) return { ok: false, error: fallback };
  const need = NEEDS.find(([text]) => error.message.includes(text))?.[1];
  return { ok: false, error: error.message, needs: need };
}

async function requireCrm() {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "crm") ? profile : null;
}

// ---------------------------------------------------------------------------
// Negócio e empresa
// ---------------------------------------------------------------------------

/** Aviso de duplicidade ao criar empresa pelo CRM: mesmo nome (parcial) ou mesmo CNPJ. */
export async function findSimilarCompaniesAction(input: {
  name: string;
  document: string;
}): Promise<{ id: string; name: string; document: string | null; lifecycle: CompanyLifecycle }[]> {
  if (!(await requireCrm())) return [];
  const name = input.name.trim();
  const document = input.document.trim();
  if (name.length < 3 && document.length < 5) return [];

  const supabase = await createClient();
  const clauses: string[] = [];
  if (name.length >= 3) clauses.push(`name.ilike.%${name.replace(/[%,()]/g, " ")}%`);
  if (document.length >= 5) clauses.push(`document.eq.${document.replace(/[,()]/g, "")}`);
  const { data } = await supabase.from("companies").select("id, name, document, lifecycle").or(clauses.join(",")).limit(5);
  return data ?? [];
}

export async function createDealAction(values: DealValues): Promise<FlowResult> {
  const actor = await requireCrm();
  if (!actor) return FORBIDDEN;
  const parsed = dealSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;
  // SDR/BDR só cria negócio para si mesmo; a RLS repete a regra no banco.
  const ownerId = canManageAllDeals(actor) ? d.ownerId : actor.id;
  const isNew = d.companyMode === "nova";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_create_deal", {
    p_company_id: arg(isNew ? null : orNull(d.companyId)),
    p_company_name: d.companyName,
    p_document: d.document,
    p_segment: d.segment,
    p_city: d.city,
    p_instagram: d.instagram,
    p_website: d.website,
    p_source: arg(orNull(d.source) as Tables["companies"]["Row"]["source"]),
    p_primary_contact_id: arg(isNew ? null : orNull(d.primaryContactId)),
    p_contact_name: d.contactName,
    p_contact_job_title: d.contactJobTitle,
    p_contact_phone: d.contactPhone,
    p_contact_email: d.contactEmail,
    p_title: d.title,
    p_owner_id: ownerId,
    p_goals: d.goals,
    p_estimated_value: arg(moneyOrNull(d.estimatedValue)),
    p_expected_close_date: arg(orNull(d.expectedCloseDate)),
    p_next_action: d.nextAction,
    p_next_action_at: nextActionAt(d.nextActionDate, d.nextActionTime),
  });
  if (error) return dbFailure(error, "Não foi possível criar o negócio.");

  refresh();
  return { ok: true, message: "Negócio criado.", id: data };
}

export async function updateDealAction(id: string, values: UpdateDealValues): Promise<FlowResult> {
  if (!idSchema.safeParse(id).success) return INVALID;
  const actor = await getCurrentProfile();
  if (!actor) return UNAUTHENTICATED;
  const parsed = updateDealSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const patch: Tables["deals"]["Update"] = {};
  const canSeeFinance = hasCapability(actor, "finance");
  if (d.primaryContactId !== undefined) patch.primary_contact_id = orNull(d.primaryContactId);
  if (d.ownerId !== undefined) patch.owner_id = d.ownerId;
  if (d.goals !== undefined) patch.prospection_goals = d.goals;
  // Sem acesso ao financeiro o formulário nem recebe o valor atual — nunca sobrescreve com vazio.
  if (d.estimatedValue !== undefined && canSeeFinance) patch.estimated_value = moneyOrNull(d.estimatedValue);
  if (d.expectedCloseDate !== undefined) patch.expected_close_date = orNull(d.expectedCloseDate);
  if (d.source !== undefined) patch.source = d.source === "" ? null : d.source;
  if (d.nextAction !== undefined) patch.next_action = d.nextAction;
  if (d.nextActionDate !== undefined) patch.next_action_at = nextActionAt(d.nextActionDate, d.nextActionTime ?? "09:00");

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("deals").update(patch).eq("id", id).select("id").maybeSingle();
  if (error) return dbFailure(error, "Não foi possível salvar o negócio.");
  if (!updated) return { ok: false, error: "Você não pode editar este negócio." };

  refresh();
  return { ok: true, message: "Salvo." };
}

export async function reassignOwnerAction(values: ReassignOwnerValues): Promise<FlowResult> {
  const actor = await getCurrentProfile();
  if (!actor || !canManageAllDeals(actor)) return FORBIDDEN;
  const parsed = reassignOwnerSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ owner_id: parsed.data.ownerId }).in("id", parsed.data.dealIds);
  if (error) return dbFailure(error, "Não foi possível reatribuir o responsável.");

  refresh();
  return { ok: true, message: `${parsed.data.dealIds.length} negócio(s) reatribuído(s).` };
}

// ---------------------------------------------------------------------------
// Interações (registro obrigatório de contato) e mudança de etapa
// ---------------------------------------------------------------------------

/** Mudança de etapa: o contato registrado e a etapa vão juntos, na mesma transação. */
export async function changeDealStageAction(values: StageChangeValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = stageChangeSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_change_stage", {
    p_deal_id: d.dealId,
    p_stage: d.stage,
    p_kind: d.kind,
    p_channel: d.channel,
    p_approach: d.approach,
    p_body: d.body,
    p_next_action: d.nextAction,
    p_next_action_at: nextActionAt(d.nextActionDate, d.nextActionTime),
  });
  if (error) return dbFailure(error, "Não foi possível mover o negócio.");

  refresh();
  return { ok: true, message: "Negócio movido." };
}

/** "+ Registrar contato": outra tentativa, sem mudar de etapa. */
export async function logContactAction(values: ContactValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;
  const hasNext = d.nextAction !== "" && d.nextActionDate !== "";

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_log_interaction", {
    p_deal_id: d.dealId,
    p_kind: "tentativa_contato",
    p_channel: d.channel,
    p_approach: d.approach,
    p_body: d.body,
    p_summary: d.summary,
    p_next_step: d.nextStep,
    ...(d.previousResponded ? { p_previous_responded: d.previousResponded === "sim" } : {}),
    p_responded_to: arg<string>(null),
    p_next_action: hasNext ? d.nextAction : arg<string>(null),
    p_next_action_at: hasNext ? nextActionAt(d.nextActionDate, d.nextActionTime) : arg<string>(null),
  });
  if (error) return dbFailure(error, "Não foi possível registrar o contato.");

  refresh();
  return { ok: true, message: "Contato registrado." };
}

/** A tentativa anterior ainda sem resposta registrada — o "Registrar contato" pergunta sobre ela. */
export async function getPendingAttemptAction(
  dealId: string,
): Promise<{ id: string; occurredAt: string; channel: string | null; summary: string } | null> {
  if (!idSchema.safeParse(dealId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_interactions")
    .select("id, occurred_at, channel, summary, body")
    .eq("deal_id", dealId)
    .eq("kind", "tentativa_contato")
    .is("responded", null)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, occurredAt: data.occurred_at, channel: data.channel, summary: data.summary ?? data.body } : null;
}

/** "Cliente respondeu": grava a resposta ligada à tentativa que ela responde. */
export async function logClientResponseAction(values: ClientResponseValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = clientResponseSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_log_interaction", {
    p_deal_id: d.dealId,
    p_kind: "resposta_cliente",
    p_channel: d.channel,
    p_approach: d.approach,
    p_body: d.body,
    p_responded_to: arg(orNull(d.respondedToId)),
    p_next_action: d.nextAction,
    p_next_action_at: nextActionAt(d.nextActionDate, d.nextActionTime),
  });
  if (error) return dbFailure(error, "Não foi possível registrar a resposta do cliente.");

  refresh();
  return { ok: true, message: "Resposta do cliente registrada." };
}

export async function markDealLostAction(values: LossValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = lossSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_mark_lost", {
    p_deal_id: parsed.data.dealId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) return dbFailure(error, "Não foi possível marcar o negócio como perdido.");

  refresh();
  return { ok: true, message: "Negócio marcado como perdido." };
}

// ---------------------------------------------------------------------------
// Qualificação
// ---------------------------------------------------------------------------

export async function saveQualificationAction(dealId: string, values: QualificationValues): Promise<FlowResult> {
  if (!idSchema.safeParse(dealId).success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = qualificationSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("deal_qualification").upsert({
    deal_id: dealId,
    budget_range: nullIfEmpty(d.budgetRange),
    project_type: nullIfEmpty(d.projectType),
    desired_timeline: nullIfEmpty(d.desiredTimeline),
    decision_maker_contacted: d.decisionMakerContacted,
    pain_point: nullIfEmpty(d.painPoint),
    notes: nullIfEmpty(d.notes),
  });
  if (error) return dbFailure(error, "Não foi possível salvar a qualificação.");

  refresh();
  return { ok: true, message: "Qualificação salva." };
}

// ---------------------------------------------------------------------------
// Reuniões, resultado e direcionamento
// ---------------------------------------------------------------------------

export async function scheduleDealMeetingAction(values: MeetingValues): Promise<FlowResult> {
  const parsed = meetingSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("deal_meetings").insert({
    deal_id: d.dealId,
    scheduled_at: dateOnlyToFortalezaTimestamp(d.scheduledDate, d.scheduledTime),
    duration_minutes: Number(d.durationMinutes),
    attendee_id: d.attendeeId,
    location_or_link: nullIfEmpty(d.locationOrLink),
    created_by: profile.id,
  });
  if (error) return dbFailure(error, "Não foi possível agendar a reunião.");

  refresh();
  return { ok: true, message: "Reunião agendada." };
}

export async function registerMeetingOutcomeAction(values: OutcomeValues): Promise<FlowResult> {
  const parsed = outcomeSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const d = parsed.data;
  const hasNext = d.nextAction !== "" && d.nextActionDate !== "";

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_register_meeting_outcome", {
    p_meeting_id: d.meetingId,
    p_result: d.result,
    p_note: d.note,
    p_next_action: hasNext ? d.nextAction : undefined,
    p_next_action_at: hasNext ? nextActionAt(d.nextActionDate, d.nextActionTime) : undefined,
    p_new_starts_at: d.newDate ? nextActionAt(d.newDate, d.newTime) : undefined,
    p_new_duration: d.newDuration ? Number(d.newDuration) : undefined,
    p_new_location: d.newLocation || undefined,
  });
  if (error) return dbFailure(error, "Não foi possível registrar o resultado da reunião.");

  refresh();
  return { ok: true, message: "Resultado registrado." };
}

export async function setDirectionAction(values: DirectionValues): Promise<FlowResult> {
  const actor = await getCurrentProfile();
  if (!actor || !canManageAllDeals(actor)) return FORBIDDEN;
  const parsed = directionSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_set_direction", {
    p_deal_id: d.dealId,
    p_task: d.task,
    p_note: d.note,
    p_due: nextActionAt(d.dueDate, d.dueTime),
  });
  if (error) return dbFailure(error, "Não foi possível salvar o direcionamento.");

  refresh();
  return { ok: true, message: "Direcionamento salvo. O SDR foi avisado." };
}

// ---------------------------------------------------------------------------
// Proposta, negociação, ganho e reaquecimento
// ---------------------------------------------------------------------------

export async function registerProposalAction(values: ProposalValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = proposalSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deal_register_proposal", {
    p_deal_id: d.dealId,
    p_amount: centsToNumber(parseMoneyToCents(d.amount) ?? 0),
    p_channel: d.channel,
    p_document_url: d.documentUrl,
    p_scope_notes: d.scopeNotes,
    p_next_action: d.nextAction,
    p_next_action_at: nextActionAt(d.nextActionDate, d.nextActionTime),
  });
  if (error) return dbFailure(error, "Não foi possível registrar a proposta.");

  refresh();
  return { ok: true, message: "Proposta registrada.", id: data };
}

export async function registerNegotiationAction(values: NegotiationValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = negotiationSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deal_register_negotiation", {
    p_deal_id: d.dealId,
    p_proposal_id: d.proposalId,
    p_client_counter: arg(moneyOrNull(d.clientCounterAmount)),
    p_our_counter: arg(moneyOrNull(d.ourCounterAmount)),
    p_agreed: arg(moneyOrNull(d.agreedAmount)),
    p_channel: d.channel,
    p_notes: d.notes,
    p_next_action: d.nextAction,
    p_next_action_at: nextActionAt(d.nextActionDate, d.nextActionTime),
  });
  if (error) return dbFailure(error, "Não foi possível registrar a negociação.");

  refresh();
  return { ok: true, message: "Negociação registrada.", id: data };
}

export async function closeDealWonAction(values: WonValues): Promise<FlowResult> {
  const actor = await getCurrentProfile();
  if (!actor || !canManageAllDeals(actor)) return FORBIDDEN;
  const parsed = wonSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;

  const supabase = await createClient();
  const { data: project, error } = await supabase.rpc("close_deal_won", {
    p_deal_id: d.dealId,
    p_project_name: d.projectName,
    p_project_model: d.projectModel,
    p_contract_value: arg(moneyOrNull(d.contractValue)),
    p_tier: d.tier,
    p_start_date: arg(orNull(d.startDate)),
    p_end_date: arg(orNull(d.endDate)),
    p_project_owner_id: d.projectOwnerId,
    p_atendimento_id: d.atendimentoId,
  });
  if (error) return dbFailure(error, "Não foi possível fechar o negócio.");

  refresh();
  revalidatePath("/projetos");
  return { ok: true, message: "Negócio ganho! Cliente e projeto criados.", projectId: project?.id };
}

export async function defineReheatAction(values: ReheatValues): Promise<FlowResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = reheatSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const d = parsed.data;
  const cents = parseMoneyToCents(d.amount);

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_define_reheat", {
    p_deal_id: d.dealId,
    p_path: d.path,
    p_body: d.body,
    p_next_action: d.nextAction,
    p_next_action_at: nextActionAt(d.nextActionDate, d.nextActionTime),
    p_proposal_amount: d.path === "venda_direta" && cents !== null ? centsToNumber(cents) : undefined,
    p_proposal_channel: d.path === "venda_direta" && d.proposalChannel !== "" ? d.proposalChannel : undefined,
    p_document_url: d.documentUrl || undefined,
    p_scope_notes: d.scopeNotes || undefined,
  });
  if (error) return dbFailure(error, "Não foi possível definir o reaquecimento.");

  refresh();
  return { ok: true, message: "Lead reaquecido." };
}

export async function discardReheatAction(dealId: string): Promise<FlowResult> {
  if (!idSchema.safeParse(dealId).success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_discard_reheat", { p_deal_id: dealId });
  if (error) return dbFailure(error, "Não foi possível descartar o reaquecimento.");

  refresh();
  return { ok: true, message: "Lead descartado do reaquecimento." };
}

// ---------------------------------------------------------------------------
// Alertas, detalhe sob demanda e configurações
// ---------------------------------------------------------------------------

/** Fogo-e-esqueça: cria os alertas de SLA da pessoa (no máximo um por negócio, tipo e dia — no banco). */
export async function syncCrmAlertsAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("sync_crm_alerts");
}

export async function getDealDetailAction(id: string): Promise<DealDetail | null> {
  if (!idSchema.safeParse(id).success) return null;
  return getDealDetail(id);
}

/** Nova regra de comissão = nova linha com vigência a partir de agora (o histórico fica). Só master/diretoria (RLS). */
export async function saveCommissionRuleAction(values: CommissionRuleValues): Promise<FlowResult> {
  const actor = await getCurrentProfile();
  if (!actor || !hasCapability(actor, "crmOverview")) return FORBIDDEN;
  const parsed = commissionRuleSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("commission_rules").insert({
    kind: parsed.data.kind,
    percent: Number(parsed.data.percent.replace(",", ".")),
  });
  if (error) return dbFailure(error, "Não foi possível salvar a regra de comissão.");

  refresh();
  return { ok: true, message: "Regra de comissão atualizada." };
}

export async function saveStageProbabilityAction(values: StageProbabilityValues): Promise<FlowResult> {
  const actor = await getCurrentProfile();
  if (!actor || !hasCapability(actor, "crmOverview")) return FORBIDDEN;
  const parsed = stageProbabilitySchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("deal_stage_probabilities").upsert({
    stage: parsed.data.stage,
    probability: Number(parsed.data.probability.replace(",", ".")) / 100,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return dbFailure(error, "Não foi possível salvar a probabilidade.");

  refresh();
  return { ok: true, message: "Probabilidade atualizada." };
}
