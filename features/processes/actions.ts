"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CREDENTIAL_WARNING } from "@/features/processes/credentials";
import { processSchema, slugify, stepSchema, type ProcessValues, type StepValues } from "@/features/processes/schemas";
import { canEditProcessSquad } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Squad } from "@/types";

const UNAUTHENTICATED = { ok: false, error: "Sessão expirada. Entre novamente." } as const;
const FORBIDDEN = { ok: false, error: "Só a diretoria, o master e o head do squad editam este fluxograma." } as const;
const uuid = z.string().uuid();

function refresh(slug?: string) {
  revalidatePath("/fluxogramas");
  if (slug) revalidatePath(`/fluxogramas/${slug}`);
}

/** Erro do banco: o bloqueio de credenciais e regras de negócio voltam com a mensagem; o resto é genérico. */
function dbError(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "22023") return error.message.includes("senha") ? CREDENTIAL_WARNING : error.message;
  if (error.code === "42501") return FORBIDDEN.error;
  return fallback;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revise os campos.";
}

async function processSquad(processId: string): Promise<{ squad: Squad; slug: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("processes").select("squad, slug").eq("id", processId).maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Processos
// ---------------------------------------------------------------------------

export async function saveProcessAction(values: ProcessValues, id?: string): Promise<ActionResult & { slug?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = processSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Fluxograma inválido." };
  const v = parsed.data;
  if (!canEditProcessSquad(profile, v.squad)) return FORBIDDEN;

  const supabase = await createClient();
  const row = {
    title: v.title,
    squad: v.squad,
    summary: v.summary || null,
    trigger_description: v.triggerDescription || null,
    frequency: v.frequency,
    owner_role: v.ownerRole || null,
    is_published: v.isPublished,
  };

  if (id) {
    const current = await processSquad(id);
    if (!current || !canEditProcessSquad(profile, current.squad)) return FORBIDDEN;
    const { error } = await supabase.from("processes").update(row).eq("id", id);
    if (error) return { ok: false, error: dbError(error, "Não foi possível salvar o fluxograma.") };
    refresh(current.slug);
    return { ok: true, message: "Fluxograma salvo.", slug: current.slug };
  }

  // Slug único: "financeiro-faturamento-do-mes", "-2", "-3"…
  const base = slugify(v.squad, v.title);
  const { data: taken } = await supabase.from("processes").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((item) => item.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

  const { data: last } = await supabase.from("processes").select("order_index").eq("squad", v.squad).order("order_index", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("processes").insert({ ...row, slug, order_index: (last?.order_index ?? 0) + 1 });
  if (error) return { ok: false, error: dbError(error, "Não foi possível criar o fluxograma.") };
  refresh(slug);
  return { ok: true, message: "Fluxograma criado. Agora adicione os passos.", slug };
}

export async function setProcessArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Fluxograma inválido." };
  const current = await processSquad(id);
  if (!current || !canEditProcessSquad(profile, current.squad)) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("processes").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: dbError(error, "Não foi possível atualizar.") };
  refresh(current.slug);
  return { ok: true, message: archived ? "Fluxograma arquivado." : "Fluxograma reativado." };
}

// ---------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------

export async function saveStepAction(processId: string, values: StepValues, stepId?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = stepSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!uuid.safeParse(processId).success || (stepId && !uuid.safeParse(stepId).success)) return { ok: false, error: "Passo inválido." };
  const current = await processSquad(processId);
  if (!current || !canEditProcessSquad(profile, current.squad)) return FORBIDDEN;
  const v = parsed.data;

  const supabase = await createClient();
  const row = {
    title: v.title,
    description: v.description || null,
    responsible_role: v.responsibleRole || null,
    system_area: v.systemArea,
    system_link: v.systemLink || null,
    done_criteria: v.doneCriteria || null,
    estimated_minutes: v.estimatedMinutes ? Number(v.estimatedMinutes) : null,
    is_blocking: v.isBlocking,
    tool: v.tool || null,
  };
  let error;
  if (stepId) {
    ({ error } = await supabase.from("process_steps").update(row).eq("id", stepId).eq("process_id", processId));
  } else {
    const { data: last } = await supabase
      .from("process_steps")
      .select("order_index")
      .eq("process_id", processId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase.from("process_steps").insert({ ...row, process_id: processId, order_index: (last?.order_index ?? 0) + 1 }));
  }
  if (error) return { ok: false, error: dbError(error, "Não foi possível salvar o passo.") };
  refresh(current.slug);
  return { ok: true, message: stepId ? "Passo salvo." : "Passo adicionado." };
}

export async function setStepArchivedAction(processId: string, stepId: string, archived: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(processId).success || !uuid.safeParse(stepId).success) return { ok: false, error: "Passo inválido." };
  const current = await processSquad(processId);
  if (!current || !canEditProcessSquad(profile, current.squad)) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase
    .from("process_steps")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", stepId)
    .eq("process_id", processId);
  if (error) return { ok: false, error: dbError(error, "Não foi possível atualizar o passo.") };
  refresh(current.slug);
  return { ok: true, message: archived ? "Passo arquivado." : "Passo reativado." };
}

/** Nova ordem dos passos (arrastar e soltar). */
export async function reorderStepsAction(processId: string, stepIds: string[]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(processId).success || stepIds.length > 200 || !stepIds.every((id) => uuid.safeParse(id).success)) return { ok: false, error: "Ordem inválida." };
  const current = await processSquad(processId);
  if (!current || !canEditProcessSquad(profile, current.squad)) return FORBIDDEN;
  const supabase = await createClient();
  const results = await Promise.all(
    stepIds.map((id, index) => supabase.from("process_steps").update({ order_index: index + 1 }).eq("id", id).eq("process_id", processId)),
  );
  if (results.some((result) => result.error)) return { ok: false, error: "Não foi possível salvar a nova ordem." };
  refresh(current.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Execuções (opcionais)
// ---------------------------------------------------------------------------

export async function startRunAction(processId: string, context: { projectId: string; label: string } | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(processId).success || (context && !uuid.safeParse(context.projectId).success)) return { ok: false, error: "Execução inválida." };
  const supabase = await createClient();
  const { data: open } = await supabase
    .from("process_runs")
    .select("id")
    .eq("process_id", processId)
    .eq("started_by", profile.id)
    .is("finished_at", null)
    .limit(1)
    .maybeSingle();
  if (open) return { ok: false, error: "Você já tem uma execução aberta deste fluxograma." };
  const { error } = await supabase.from("process_runs").insert({
    process_id: processId,
    started_by: profile.id,
    context_entity_type: context ? "project" : null,
    context_entity_id: context?.projectId ?? null,
    context_label: context ? context.label.slice(0, 200) : null,
  });
  if (error) return { ok: false, error: dbError(error, "Não foi possível iniciar a execução.") };
  const process = await processSquad(processId);
  refresh(process?.slug);
  return { ok: true, message: "Execução iniciada. Marque os passos conforme for fazendo." };
}

export async function toggleRunStepAction(runId: string, stepId: string, done: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(runId).success || !uuid.safeParse(stepId).success) return { ok: false, error: "Passo inválido." };
  const supabase = await createClient();
  const { error } = done
    ? await supabase.from("process_run_steps").upsert({ run_id: runId, step_id: stepId }, { onConflict: "run_id,step_id", ignoreDuplicates: true })
    : await supabase.from("process_run_steps").delete().eq("run_id", runId).eq("step_id", stepId);
  if (error) return { ok: false, error: dbError(error, "Não foi possível marcar o passo.") };
  return { ok: true };
}

export async function finishRunAction(runId: string, slug: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(runId).success) return { ok: false, error: "Execução inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("process_runs").update({ finished_at: new Date().toISOString() }).eq("id", runId).is("finished_at", null);
  if (error) return { ok: false, error: dbError(error, "Não foi possível concluir.") };
  refresh(slug);
  return { ok: true, message: "Execução concluída e guardada no histórico." };
}

export async function discardRunAction(runId: string, slug: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(runId).success) return { ok: false, error: "Execução inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("process_runs").delete().eq("id", runId).is("finished_at", null);
  if (error) return { ok: false, error: dbError(error, "Não foi possível descartar.") };
  refresh(slug);
  return { ok: true, message: "Execução descartada." };
}
