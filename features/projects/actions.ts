"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

export interface ProjectFinalizationStatus {
  projectId: string;
  projectName: string;
  ready: boolean;
  finalized: boolean;
  transactional: boolean;
  pendingPautas: number;
  openReceivables: number;
  canFinalize: boolean;
}

const idSchema = z.string().uuid();

/** Situação do projeto para o pop-up "Finalizar projeto" (pautas pendentes, recebimentos em aberto). */
export async function getProjectFinalizationAction(projectId: string): Promise<ProjectFinalizationStatus | null> {
  if (!idSchema.safeParse(projectId).success) return null;
  const supabase = await createClient();
  const [{ data }, { data: canFinalize }] = await Promise.all([
    supabase.rpc("project_finalization_status", { p_project_id: projectId }),
    supabase.rpc("can_finalize_project", { p_project_id: projectId }),
  ]);
  const row = data?.[0];
  if (!row) return null;
  return {
    projectId,
    projectName: row.project_name,
    ready: row.ready,
    finalized: row.finalized,
    transactional: row.model === "transacional",
    pendingPautas: row.pending_pautas,
    openReceivables: row.open_receivables,
    canFinalize: canFinalize === true,
  };
}

/** Confirma a finalização. É daqui que conta o prazo de 30 dias para a prospecção do cliente. */
export async function finalizeProjectAction(projectId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(projectId).success) return { ok: false, error: "Projeto inválido." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_project", { p_project_id: projectId });
  if (error) return { ok: false, error: error.code === "42501" ? error.message : "Não foi possível finalizar o projeto." };
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath("/projetos");
  return { ok: true, message: "Projeto finalizado. Em 30 dias o comercial recebe a tarefa de prospecção deste cliente." };
}
