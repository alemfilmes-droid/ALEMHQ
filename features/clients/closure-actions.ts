"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CLOSURE_REASONS, PROSPECT_POTENTIALS } from "@/features/clients/closures";
import { canCloseClients } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import { Constants } from "@/types/database";

const Enums = Constants.public.Enums;

const FORBIDDEN: ActionResult = { ok: false, error: "Só diretoria e master encerram clientes e projetos." };
const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

/** O que a prévia devolve (jsonb do banco), validado antes de chegar à tela. Valores só com acesso ao financeiro. */
const financeItem = z.object({
  id: uuid,
  description: z.string(),
  due_date: z.string(),
  project: z.string().nullable(),
  amount: z.number().nullable(),
  overdue: z.boolean(),
});

const previewSchema = z.object({
  finance_visible: z.boolean(),
  company: z.object({ id: uuid, name: z.string(), lifecycle: z.enum(Enums.company_lifecycle), health: z.enum(Enums.client_health) }),
  projects: z.array(z.object({ id: uuid, name: z.string(), stage: z.enum(Enums.project_stage), model: z.enum(Enums.project_model) })),
  pautas: z.array(z.object({ id: uuid, title: z.string(), assignee: z.string().nullable(), squad: z.enum(Enums.squad) })),
  receivables: z.array(financeItem),
  payables: z.array(financeItem.extend({ payee: z.string().nullable(), scheduled: z.boolean() })),
  invoice_schedules: z.number(),
  open_deals: z.number(),
  active_closure: z.object({ id: uuid, reason: z.string(), closed_at: z.string() }).nullable(),
});

type RawPreview = z.infer<typeof previewSchema>;

export interface ClosurePreview {
  financeVisible: boolean;
  company: RawPreview["company"];
  projects: RawPreview["projects"];
  pautas: RawPreview["pautas"];
  receivables: RawPreview["receivables"];
  payables: RawPreview["payables"];
  invoiceSchedules: number;
  openDeals: number;
}

export async function getClosurePreviewAction(companyId: string, projectId: string | null, closedAt: string): Promise<ClosurePreview | null> {
  const profile = await getCurrentProfile();
  if (!profile || !canCloseClients(profile)) return null;
  if (!uuid.safeParse(companyId).success || (projectId && !uuid.safeParse(projectId).success) || !isoDate.safeParse(closedAt).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_closure_preview", {
    p_company_id: companyId,
    p_closed_at: closedAt,
    ...(projectId ? { p_project_id: projectId } : {}),
  });
  if (error) return null;
  const parsed = previewSchema.safeParse(data);
  if (!parsed.success) return null;
  const raw = parsed.data;
  return {
    financeVisible: raw.finance_visible,
    company: raw.company,
    projects: raw.projects,
    pautas: raw.pautas,
    receivables: raw.receivables,
    payables: raw.payables,
    invoiceSchedules: raw.invoice_schedules,
    openDeals: raw.open_deals,
  };
}

const closeSchema = z
  .object({
    companyId: uuid,
    projectId: uuid.or(z.literal("")),
    reason: z.enum(CLOSURE_REASONS, { message: "Escolha o motivo." }),
    description: z.string().trim().min(10, "Explique o que aconteceu (pelo menos uma frase).").max(4000, "Use até 4000 caracteres."),
    closedAt: isoDate,
    hasPendingReceivables: z.enum(["sim", "nao"], { message: "Responda se há valores a receber." }),
    pendingReceivablesNote: z.string().trim().max(1000, "Use até 1000 caracteres."),
    keepReceivableIds: z.array(uuid),
    hasPendingPayables: z.enum(["sim", "nao"], { message: "Responda se há custos a pagar." }),
    pendingPayablesNote: z.string().trim().max(1000, "Use até 1000 caracteres."),
    keepPayableIds: z.array(uuid),
    potential: z.enum(PROSPECT_POTENTIALS, { message: "Escolha o potencial de voltar a prospectar." }),
    notes: z.string().trim().max(2000, "Use até 2000 caracteres."),
  })
  .refine((value) => value.hasPendingReceivables === "nao" || value.keepReceivableIds.length > 0 || value.pendingReceivablesNote !== "", {
    message: "Diga quais valores ainda vão entrar e quando (marque os lançamentos ou descreva).",
    path: ["pendingReceivablesNote"],
  })
  .refine((value) => value.hasPendingPayables === "nao" || value.keepPayableIds.length > 0 || value.pendingPayablesNote !== "", {
    message: "Diga quais custos ainda vão sair e quando (marque os lançamentos ou descreva).",
    path: ["pendingPayablesNote"],
  });

export type CloseClientValues = z.input<typeof closeSchema>;

function refresh(companyId: string, projectId: string | null) {
  revalidatePath("/clientes", "layout");
  revalidatePath("/projetos", "layout");
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  revalidatePath("/financeiro");
  revalidatePath("/crm");
  revalidatePath(`/clientes/${companyId}`);
  if (projectId) revalidatePath(`/projetos/${projectId}`);
}

function failure(error: { code?: string; message: string }, fallback: string): ActionResult {
  return { ok: false, error: ["23514", "42501", "22023"].includes(error.code ?? "") ? error.message : fallback };
}

/** Confirma o encerramento: o banco faz a cascata inteira (close_client) numa transação só. */
export async function closeClientAction(values: CloseClientValues): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!canCloseClients(profile)) return FORBIDDEN;
  const parsed = closeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos e tente novamente." };
  const d = parsed.data;
  const projectId = d.projectId === "" ? null : d.projectId;
  const pendingReceivables = d.hasPendingReceivables === "sim";
  const pendingPayables = d.hasPendingPayables === "sim";

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_client", {
    p_company_id: d.companyId,
    p_project_id: projectId,
    p_reason: d.reason,
    p_description: d.description,
    p_closed_at: d.closedAt,
    p_has_pending_receivables: pendingReceivables,
    p_pending_receivables_note: pendingReceivables ? d.pendingReceivablesNote : "",
    p_keep_receivable_ids: pendingReceivables ? d.keepReceivableIds : [],
    p_has_pending_payables: pendingPayables,
    p_pending_payables_note: pendingPayables ? d.pendingPayablesNote : "",
    p_keep_payable_ids: pendingPayables ? d.keepPayableIds : [],
    p_notes: d.notes,
    p_potential: d.potential,
  });
  if (error) return failure(error, projectId ? "Não foi possível encerrar o projeto." : "Não foi possível encerrar o cliente.");

  refresh(d.companyId, projectId);
  return { ok: true, message: projectId ? "Projeto encerrado." : "Cliente encerrado." };
}

/** Volta a ser cliente. Projetos encerrados e lançamentos cancelados continuam como estão. */
export async function reopenClientAction(companyId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!canCloseClients(profile)) return { ok: false, error: "Só diretoria e master reativam clientes." };
  if (!uuid.safeParse(companyId).success) return { ok: false, error: "Cliente inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_client", { p_company_id: companyId });
  if (error) return failure(error, "Não foi possível reativar o cliente.");

  refresh(companyId, null);
  return { ok: true, message: "Cliente reativado." };
}
