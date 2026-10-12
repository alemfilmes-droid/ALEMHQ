"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROSPECTION_GOALS } from "@/features/crm/labels";
import { CLOSURE_REASONS, PROSPECT_POTENTIALS } from "@/features/clients/closures";
import { centsToNumber, parseMoneyToCents } from "@/features/finance/money";
import { canCloseClients } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { addDays, appZoneToIso, todayInAppZone } from "@/lib/calendar";
import { isLastActiveProject } from "@/lib/clients/lifecycle";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import type { Json } from "@/types/database";

/**
 * Ciclo de vida do cliente (Bloco 6): encerrar (Churn/Encerrado), pausar, reativar e reabrir a
 * prospecção. A cascata inteira roda no banco numa transação só (client_close / client_pause /
 * client_reactivate); aqui só a validação e a revalidação das telas.
 */

const FORBIDDEN: ActionResult = { ok: false, error: "Só diretoria e master encerram, pausam e reativam clientes." };
const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");
const money = z.string().refine((value) => (parseMoneyToCents(value) ?? 0) > 0, "Informe um valor maior que zero.");

const manualReceivable = z.object({ description: z.string().trim().min(2, "Informe a descrição.").max(160), amount: money, dueDate: isoDate });
const manualPayable = manualReceivable.extend({ payeeName: z.string().trim().min(2, "Informe o favorecido.").max(120) });

const closeSchema = z.object({
  companyId: uuid,
  reason: z.enum(CLOSURE_REASONS).refine((value) => value !== "pausa_temporaria", "Para pausar, use “Pausar cliente”."),
  description: z.string().trim().min(10, "Explique o que aconteceu (pelo menos 10 letras).").max(2000),
  closedAt: isoDate,
  potential: z.enum(PROSPECT_POTENTIALS, { message: "Informe o potencial de prospecção futura." }),
  notes: z.string().trim().max(500),
  keepReceivableIds: z.array(uuid),
  keepPayableIds: z.array(uuid),
  manualReceivables: z.array(manualReceivable).max(20),
  manualPayables: z.array(manualPayable).max(20),
});

export type ClientCloseValues = z.input<typeof closeSchema>;

const pauseSchema = z.object({
  companyId: uuid,
  description: z.string().trim().min(10, "Explique o motivo da pausa (pelo menos 10 letras).").max(2000),
  closedAt: isoDate,
  notes: z.string().trim().max(500),
});

async function requireCloser() {
  const profile = await getCurrentProfile();
  return profile && canCloseClients(profile) ? profile : null;
}

function refresh(companyId: string) {
  revalidatePath("/clientes", "layout");
  revalidatePath(`/clientes/${companyId}`);
  revalidatePath("/projetos", "layout");
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  revalidatePath("/financeiro");
  revalidatePath("/crm");
  revalidatePath("/inicio");
}

function failure(error: { code?: string; message: string }, fallback: string): ActionResult {
  return { ok: false, error: ["23514", "42501", "22023"].includes(error.code ?? "") ? error.message : fallback };
}

const amount = (input: string) => centsToNumber(parseMoneyToCents(input) ?? 0);

/** Encerrar (Churn ou Encerrado): projetos, pautas e o financeiro escolhido — tudo numa transação. */
export async function clientCloseAction(values: ClientCloseValues): Promise<ActionResult> {
  if (!(await requireCloser())) return FORBIDDEN;
  const parsed = closeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos e tente novamente." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("client_close", {
    p_company_id: d.companyId,
    p_reason: d.reason,
    p_description: d.description,
    p_closed_at: d.closedAt,
    p_keep_receivable_ids: d.keepReceivableIds,
    p_keep_payable_ids: d.keepPayableIds,
    p_manual_receivables: d.manualReceivables.map((entry) => ({ description: entry.description, amount: amount(entry.amount), due_date: entry.dueDate })) as Json,
    p_manual_payables: d.manualPayables.map((entry) => ({ description: entry.description, amount: amount(entry.amount), due_date: entry.dueDate, payee_name: entry.payeeName })) as Json,
    p_potential: d.potential,
    ...(d.notes ? { p_notes: d.notes } : {}),
  });
  if (error) return failure(error, "Não foi possível encerrar o cliente. Nada foi alterado.");
  refresh(d.companyId);
  return { ok: true, message: d.reason === "churn" ? "Cliente encerrado como churn." : "Cliente encerrado." };
}

/** Pausar: projetos e pautas pausados; o financeiro não muda. */
export async function clientPauseAction(values: z.input<typeof pauseSchema>): Promise<ActionResult> {
  if (!(await requireCloser())) return FORBIDDEN;
  const parsed = pauseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos e tente novamente." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_pause", {
    p_company_id: d.companyId,
    p_description: d.description,
    p_closed_at: d.closedAt,
    ...(d.notes ? { p_notes: d.notes } : {}),
  });
  if (error) return failure(error, "Não foi possível pausar o cliente. Nada foi alterado.");
  refresh(d.companyId);
  return { ok: true, message: "Cliente pausado. Projetos e pautas ficaram pausados." };
}

/** Reativar. Se estava pausado, `restorePaused` decide se projetos e pautas voltam também. */
export async function clientReactivateAction(companyId: string, restorePaused: boolean): Promise<ActionResult> {
  if (!(await requireCloser())) return FORBIDDEN;
  if (!uuid.safeParse(companyId).success) return { ok: false, error: "Cliente inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_reactivate", { p_company_id: companyId, p_restore_paused: restorePaused });
  if (error) return failure(error, "Não foi possível reativar o cliente.");
  refresh(companyId);
  return { ok: true, message: restorePaused ? "Cliente reativado com os projetos e pautas." : "Cliente reativado." };
}

const prospectionSchema = z.object({
  companyId: uuid,
  playbookId: uuid,
  ownerId: uuid,
  goal: z.enum(PROSPECTION_GOALS, { message: "Escolha o objetivo." }),
});

/** Opções de "Reabrir prospecção": playbooks, SDRs do comercial e o SDR padrão da empresa. */
export async function prospectionOptionsAction(): Promise<{
  playbooks: { id: string; name: string; audience: string }[];
  sdrs: { id: string; name: string }[];
  defaultSdrId: string | null;
}> {
  const profile = await requireCloser();
  if (!profile) return { playbooks: [], sdrs: [], defaultSdrId: null };
  const supabase = await createClient();
  const [playbooks, comercial, settings] = await Promise.all([
    supabase.from("prospect_playbooks").select("id, name, audience").eq("active", true).order("position"),
    supabase.from("profile_squads").select("profile:profiles!inner(id, full_name, is_active)").eq("squad", "comercial"),
    supabase.from("company_settings").select("prospect_sdr_id").eq("id", true).maybeSingle(),
  ]);
  const sdrs = (comercial.data ?? []).map((row) => row.profile).filter((person) => person.is_active).map((person) => ({ id: person.id, name: person.full_name }));
  const configured = settings.data?.prospect_sdr_id ?? null;
  return {
    playbooks: (playbooks.data ?? []).map((row) => ({ id: row.id, name: row.name, audience: row.audience })),
    sdrs,
    defaultSdrId: configured && sdrs.some((sdr) => sdr.id === configured) ? configured : (sdrs[0]?.id ?? null),
  };
}

/**
 * "Reabrir prospecção" num cliente inativo: negócio novo no CRM ligado ao cliente (o histórico continua
 * no cliente e no negócio anterior), com playbook e SDR escolhidos. O cliente segue inativo até ganhar.
 */
export async function reopenProspectionAction(values: z.input<typeof prospectionSchema>): Promise<ActionResult & { dealId?: string }> {
  if (!(await requireCloser())) return FORBIDDEN;
  const parsed = prospectionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;

  const supabase = await createClient();
  const [{ data: company }, { data: contact }, { data: lastDeal }, { data: playbook }] = await Promise.all([
    supabase.from("companies").select("id, name, lifecycle, deleted_at").eq("id", d.companyId).maybeSingle(),
    supabase.from("contacts").select("id").eq("company_id", d.companyId).order("created_at").limit(1).maybeSingle(),
    supabase.from("deals").select("id").eq("company_id", d.companyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prospect_playbooks").select("id, audience").eq("id", d.playbookId).maybeSingle(),
  ]);
  if (!company || company.deleted_at || company.lifecycle !== "former_client") return { ok: false, error: "Só um cliente inativo reabre a prospecção." };
  if (!playbook) return { ok: false, error: "Escolha um playbook." };

  const { data: dealId, error } = await supabase.rpc("crm_create_deal", {
    p_company_id: company.id,
    p_company_name: company.name,
    p_document: "",
    p_segment: "",
    p_city: "",
    p_instagram: "",
    p_website: "",
    p_source: "cliente_antigo",
    p_primary_contact_id: (contact?.id ?? null) as string,
    p_contact_name: "",
    p_contact_job_title: "",
    p_contact_phone: "",
    p_contact_email: "",
    p_title: `Reabrir prospecção · ${company.name}`,
    p_owner_id: d.ownerId,
    p_goals: [d.goal],
    p_estimated_value: null as unknown as number,
    p_expected_close_date: null as unknown as string,
    p_next_action: "Retomar contato com o cliente",
    p_next_action_at: appZoneToIso(addDays(todayInAppZone(), 1), "09:00"),
  });
  if (error || !dealId) return failure(error ?? { message: "" }, "Não foi possível criar o negócio.");

  const now = new Date().toISOString();
  await supabase
    .from("deals")
    .update({
      prospect_playbook_id: playbook.id,
      prospect_lead_type: playbook.audience,
      prospect_contact_is_decision_maker: true,
      prospect_cadence_started_at: now,
      prospect_origin_deal_id: lastDeal?.id ?? null,
    })
    .eq("id", dealId);

  refresh(d.companyId);
  return { ok: true, message: "Prospecção reaberta: o negócio entrou no CRM.", dealId };
}

/** Depois de finalizar um projeto: era o último ativo do cliente? (pergunta "O cliente foi finalizado?") */
export async function lastProjectCheckAction(projectId: string): Promise<{ companyId: string; companyName: string } | null> {
  if (!(await requireCloser()) || !uuid.safeParse(projectId).success) return null;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("company_id, is_internal, company:companies(name, lifecycle)").eq("id", projectId).maybeSingle();
  if (!project?.company_id || project.is_internal || project.company?.lifecycle !== "client") return null;
  const { data: active } = await supabase
    .from("projects")
    .select("id")
    .eq("company_id", project.company_id)
    .eq("is_internal", false)
    .is("finalized_at", null)
    .not("stage", "in", "(entregue,cancelado,encerrado)");
  return isLastActiveProject(projectId, (active ?? []).map((row) => row.id)) ? { companyId: project.company_id, companyName: project.company.name } : null;
}
