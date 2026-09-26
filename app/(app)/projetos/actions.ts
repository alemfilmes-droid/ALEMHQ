"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorizeCapability, getCurrentProfile } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { nullIfEmpty } from "@/lib/validations/company";
import {
  financialsSchema,
  parseMoney,
  projectSchema,
  stageSchema,
  updateProjectMembersSchema,
  updateProjectSchema,
  type FinancialsValues,
  type ProjectValues,
  type UpdateProjectValues,
} from "@/lib/validations/project";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, ProjectStage } from "@/types";
import type { Database } from "@/types/database";

const FORBIDDEN: ActionResult = { ok: false, error: "Você não tem permissão para esta ação." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };

export async function createProjectAction(values: ProjectValues): Promise<ActionResult> {
  const actor = await authorizeCapability("manageProjects");
  if (!actor) return FORBIDDEN;
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const data = parsed.data;
  const hasFinancialInput = data.contractValue !== "" || data.paymentTerms !== "" || data.costs.length > 0;
  const canFinance = hasCapability(actor, "finance");
  if (hasFinancialInput && !canFinance) return FORBIDDEN;

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: data.name,
      is_internal: data.isInternal,
      // Interno nunca carrega cliente ou contato.
      company_id: data.isInternal ? null : nullIfEmpty(data.companyId),
      contact_id: data.isInternal ? null : nullIfEmpty(data.contactId),
      stage: data.stage,
      model: data.model,
      due_date: data.model === "transacional" ? nullIfEmpty(data.dueDate) : null,
      start_date: data.model === "recorrente" ? nullIfEmpty(data.startDate) : null,
      end_date: data.model === "recorrente" ? nullIfEmpty(data.endDate) : null,
      owner_id: data.ownerId,
      priority: data.priority,
      service_types: data.serviceTypes,
      briefing: nullIfEmpty(data.briefing),
      drive_folder_url: nullIfEmpty(data.driveFolderUrl),
      included_revision_rounds: data.includedRevisionRounds === "" ? null : Number(data.includedRevisionRounds),
    })
    .select("id")
    .single();
  if (error) {
    const mismatch = error.code === "23514";
    return { ok: false, error: mismatch ? "O contato não pertence a este cliente." : "Não foi possível criar o projeto." };
  }

  // O responsável também entra como membro, para constar na equipe do projeto.
  const memberIds = Array.from(new Set([data.ownerId, ...data.memberIds]));
  const { error: membersError } = await supabase
    .from("project_members")
    .insert(memberIds.map((profileId) => ({ project_id: project.id, profile_id: profileId })));
  if (membersError) {
    revalidatePath("/projetos");
    return { ok: false, error: "Projeto criado, mas a equipe não foi salva. Abra o projeto para ajustar." };
  }

  if (canFinance && (data.contractValue !== "" || data.paymentTerms !== "")) {
    const { error: financeError } = await supabase.from("project_financials").insert({
      project_id: project.id,
      contract_value: parseMoney(data.contractValue),
      payment_terms: nullIfEmpty(data.paymentTerms),
    });
    if (financeError) {
      revalidatePath("/projetos");
      return { ok: false, error: "Projeto criado, mas os dados financeiros não foram salvos. Abra a aba Financeiro." };
    }
  }

  if (canFinance && data.costs.length > 0) {
    const { error: costsError } = await supabase.from("payables").insert(
      data.costs.map((cost) => ({
        project_id: project.id,
        category: cost.category,
        description: cost.description,
        amount: Number(cost.amount.replace(",", ".")),
        due_date: cost.dueDate || new Date().toISOString().slice(0, 10),
      })),
    );
    if (costsError) {
      revalidatePath("/projetos");
      return { ok: false, error: "Projeto criado, mas os custos previstos não foram salvos. Abra a aba Financeiro." };
    }
  }

  revalidatePath("/projetos");
  redirect(`/projetos/${project.id}`);
}

export async function updateProjectStageAction(input: { id: string; stage: ProjectStage }): Promise<ActionResult> {
  if (!(await authorizeCapability("manageProjects"))) return FORBIDDEN;
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ stage: parsed.data.stage }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Não foi possível mover o projeto." };

  revalidatePath(`/projetos/${parsed.data.id}`);
  return { ok: true, message: "Etapa atualizada." };
}

/** Edição inline da visão geral (só diretoria — RLS de projects também exige is_director()). */
export async function updateProjectAction(id: string, values: UpdateProjectValues): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return INVALID;
  if (!(await authorizeCapability("manageProjects"))) return FORBIDDEN;
  const parsed = updateProjectSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const d = parsed.data;
  const patch: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (d.stage !== undefined) patch.stage = d.stage;
  if (d.priority !== undefined) patch.priority = d.priority;
  if (d.ownerId !== undefined) patch.owner_id = d.ownerId;
  if (d.contactId !== undefined) patch.contact_id = d.contactId;
  if (d.serviceTypes !== undefined) patch.service_types = d.serviceTypes;
  if (d.dueDate !== undefined) patch.due_date = d.dueDate;
  if (d.startDate !== undefined) patch.start_date = d.startDate;
  if (d.endDate !== undefined) patch.end_date = d.endDate;
  if (d.briefing !== undefined) patch.briefing = d.briefing === null ? null : nullIfEmpty(d.briefing);
  if (d.productionNotes !== undefined) patch.production_notes = d.productionNotes === null ? null : nullIfEmpty(d.productionNotes);
  if (d.deliveryNotes !== undefined) patch.delivery_notes = d.deliveryNotes === null ? null : nullIfEmpty(d.deliveryNotes);
  if (d.locationAddress !== undefined) patch.location_address = d.locationAddress === null ? null : nullIfEmpty(d.locationAddress);
  if (d.locationNotes !== undefined) patch.location_notes = d.locationNotes === null ? null : nullIfEmpty(d.locationNotes);
  if (d.driveFolderUrl !== undefined) patch.drive_folder_url = d.driveFolderUrl === null ? null : nullIfEmpty(d.driveFolderUrl);
  if (d.includedRevisionRounds !== undefined) patch.included_revision_rounds = d.includedRevisionRounds;

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath(`/projetos/${id}`);
  return { ok: true, message: "Salvo." };
}

/** Troca simples: remove todos os responsáveis e regrava os selecionados. */
export async function updateProjectMembersAction(input: { id: string; memberIds: string[] }): Promise<ActionResult> {
  const parsed = updateProjectMembersSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  if (!(await authorizeCapability("manageProjects"))) return FORBIDDEN;

  const supabase = await createClient();
  const { error: deleteError } = await supabase.from("project_members").delete().eq("project_id", parsed.data.id);
  if (deleteError) return { ok: false, error: "Não foi possível salvar os responsáveis." };

  if (parsed.data.memberIds.length > 0) {
    const { error: insertError } = await supabase
      .from("project_members")
      .insert(parsed.data.memberIds.map((profileId) => ({ project_id: parsed.data.id, profile_id: profileId })));
    if (insertError) return { ok: false, error: "Não foi possível salvar os responsáveis." };
  }

  revalidatePath(`/projetos/${parsed.data.id}`);
  return { ok: true, message: "Responsáveis atualizados." };
}

export async function saveFinancialsAction(projectId: string, values: FinancialsValues): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor || !hasCapability(actor, "finance")) return FORBIDDEN;
  const parsed = financialsSchema.safeParse(values);
  if (!z.string().uuid().safeParse(projectId).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("project_financials").upsert({
    project_id: projectId,
    contract_value: parseMoney(parsed.data.contractValue),
    payment_terms: nullIfEmpty(parsed.data.paymentTerms),
  });
  if (error) return { ok: false, error: "Não foi possível salvar o financeiro." };

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, message: "Financeiro salvo." };
}

const quickProjectSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do projeto.").max(140, "Use até 140 caracteres."),
  /** null = projeto interno da Além Filmes (sem cliente). */
  companyId: z.string().uuid().nullable(),
});

/**
 * Atalho "Criar projeto" do diálogo de nova pauta, quando o cliente escolhido ainda não tem projeto:
 * só o nome — o resto (modelo, prazos, financeiro) se completa depois na página do projeto. Mesma
 * permissão do cadastro completo (capability manageProjects + RLS de projects).
 */
export async function createQuickProjectAction(input: { name: string; companyId: string | null }): Promise<
  ActionResult & { project?: { id: string; name: string; company_id: string | null; is_internal: boolean } }
> {
  const actor = await authorizeCapability("manageProjects");
  if (!actor) return FORBIDDEN;
  const parsed = quickProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise o nome do projeto." };

  const isInternal = parsed.data.companyId === null;
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name, company_id: parsed.data.companyId, is_internal: isInternal, owner_id: actor.id })
    .select("id, name, company_id, is_internal")
    .single();
  if (error) return { ok: false, error: "Não foi possível criar o projeto." };

  await supabase.from("project_members").insert({ project_id: project.id, profile_id: actor.id });
  revalidatePath("/projetos");
  return { ok: true, message: "Projeto criado.", project };
}
