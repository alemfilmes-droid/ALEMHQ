"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { canDeleteClients } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { CONFIRM_ANONYMIZE, type DeletionSummary } from "@/lib/clients/deletion";
import { syncGoogleForProfiles } from "@/lib/google/calendar.server";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * Excluir clientes (Bloco 8C): só a conta master. Tudo roda no banco numa transação só
 * (client_delete / client_restore / client_purge / client_anonymize), que confere a permissão de novo.
 */

const FORBIDDEN: ActionResult = { ok: false, error: "Só a conta master exclui, restaura ou anonimiza clientes." };
const uuid = z.string().uuid();

const deleteSchema = z.object({
  companyId: uuid,
  confirmName: z.string().max(200),
  reason: z.string().trim().max(300, "O motivo pode ter no máximo 300 letras."),
  cancelCommitmentIds: z.array(uuid).max(100),
});

async function requireMaster() {
  const profile = await getCurrentProfile();
  return profile && canDeleteClients(profile) ? profile : null;
}

function refresh(companyId: string) {
  revalidatePath("/clientes", "layout");
  revalidatePath(`/clientes/${companyId}`);
  revalidatePath("/projetos", "layout");
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  revalidatePath("/financeiro");
  revalidatePath("/crm");
  revalidatePath("/agenda");
  revalidatePath("/orcamentos");
  revalidatePath("/inicio");
}

function failure(error: { code?: string; message: string }, fallback: string): { ok: false; error: string } {
  return { ok: false, error: ["23514", "42501", "22023"].includes(error.code ?? "") ? error.message : fallback };
}

/** Resumo do que está ligado ao cliente, para a janela "Excluir cliente". */
export async function deletionSummaryAction(companyId: string): Promise<{ ok: true; summary: DeletionSummary } | { ok: false; error: string }> {
  if (!(await requireMaster())) return { ok: false, error: "Só a conta master exclui clientes." };
  if (!uuid.safeParse(companyId).success) return { ok: false, error: "Cliente inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_deletion_summary", { p_company_id: companyId });
  if (error || !data) return failure(error ?? { message: "" }, "Não foi possível carregar o resumo do cliente.");
  return { ok: true, summary: data as unknown as DeletionSummary };
}

/** Sem histórico: apaga de vez. Com histórico: vai para a Lixeira (nada é apagado). */
export async function deleteClientAction(values: z.input<typeof deleteSchema>): Promise<ActionResult & { mode?: "permanent" | "trash" }> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = deleteSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_delete", {
    p_company_id: d.companyId,
    p_confirm_name: d.confirmName,
    p_cancel_commitment_ids: d.cancelCommitmentIds,
    ...(d.reason ? { p_reason: d.reason } : {}),
  });
  if (error || !data) return failure(error ?? { message: "" }, "Não foi possível excluir o cliente. Nada foi alterado.");

  const result = data as { mode: "permanent" | "trash"; sync_profiles: string[] };
  // Reuniões canceladas: a sincronização tira os eventos do Google de quem tem a conta conectada.
  if (result.sync_profiles.length > 0) {
    after(() => syncGoogleForProfiles(result.sync_profiles).catch((cause) => console.error("[google] sync após excluir cliente falhou", cause)));
  }
  refresh(d.companyId);
  return result.mode === "permanent"
    ? { ok: true, message: "Cliente excluído permanentemente.", mode: result.mode }
    : { ok: true, message: "Cliente enviado para a Lixeira (Clientes → Lixeira).", mode: result.mode };
}

/** Restaurar: o cliente e os negócios voltam; projetos e pautas continuam finalizados. */
export async function restoreClientAction(companyId: string): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  if (!uuid.safeParse(companyId).success) return { ok: false, error: "Cliente inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_restore", { p_company_id: companyId });
  if (error) return failure(error, "Não foi possível restaurar o cliente.");
  refresh(companyId);
  return { ok: true, message: "Cliente restaurado. Projetos e pautas continuam finalizados: reative à mão se precisar." };
}

/** Excluir definitivamente da Lixeira: só sem lançamentos financeiros e sem contar em metas. */
export async function purgeClientAction(companyId: string, confirmName: string): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  if (!uuid.safeParse(companyId).success || confirmName.length > 200) return { ok: false, error: "Cliente inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_purge", { p_company_id: companyId, p_confirm_name: confirmName });
  if (error) return failure(error, "Não foi possível excluir o cliente. Nada foi alterado.");
  refresh(companyId);
  return { ok: true, message: "Cliente excluído definitivamente." };
}

/** Anonimizar (LGPD): "Removido" nos dados pessoais; valores, datas e categorias ficam. Sem volta. */
export async function anonymizeClientAction(companyId: string, confirm: string): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  if (!uuid.safeParse(companyId).success) return { ok: false, error: "Cliente inválido." };
  if (confirm !== CONFIRM_ANONYMIZE) return { ok: false, error: `Digite ${CONFIRM_ANONYMIZE} para confirmar.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_anonymize", { p_company_id: companyId, p_confirm: confirm });
  if (error) return failure(error, "Não foi possível anonimizar o cliente. Nada foi alterado.");
  refresh(companyId);
  return { ok: true, message: "Dados pessoais do cliente removidos." };
}
