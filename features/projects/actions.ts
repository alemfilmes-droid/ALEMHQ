"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { BOARD_COLUMNS, BOARD_COLUMN_LABELS, MIN_CHURN_REASON } from "@/lib/projects/board";
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

const boardMoveSchema = z.object({
  projectId: z.string().uuid(),
  to: z.enum(BOARD_COLUMNS),
  reason: z.string().trim().max(500).optional(),
  confirmed: z.boolean().optional(),
});

/**
 * Quadro de Projetos: move entre Ativos, Encerrados e Churn. Churn exige motivo; Encerrar exige confirmação.
 * O banco (project_board_move) confere a permissão e o motivo de novo e registra quem/quando.
 */
export async function moveProjectOnBoardAction(input: z.input<typeof boardMoveSchema>): Promise<ActionResult> {
  const parsed = boardMoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimento inválido." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const d = parsed.data;
  if (d.to === "churn" && (d.reason ?? "").length < MIN_CHURN_REASON) return { ok: false, error: "Informe o motivo do churn." };
  if (d.to === "encerrados" && !d.confirmed) return { ok: false, error: "Confirme o encerramento do projeto." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("project_board_move", { p_project_id: d.projectId, p_to: d.to, p_reason: d.reason ?? "" });
  if (error) {
    console.error("moveProjectOnBoardAction:", error.code, error.message);
    return { ok: false, error: error.code === "42501" || error.code === "22023" ? error.message : "Não foi possível mover o projeto." };
  }
  revalidatePath("/projetos");
  revalidatePath(`/projetos/${d.projectId}`);
  revalidatePath("/clientes", "layout");
  return { ok: true, message: `Projeto movido para ${BOARD_COLUMN_LABELS[d.to]}.` };
}
