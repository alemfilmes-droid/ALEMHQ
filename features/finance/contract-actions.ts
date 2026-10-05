"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { centsToNumber, toCents, type Cents } from "@/features/finance/money";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * Valor do contrato x orçamento. Só quem tem acesso ao financeiro decide; o banco repete a regra
 * (has_finance_access() em budget_contract_status, project_contract_plan e
 * project_apply_contract_change).
 */

export type ContractMode = "definicao" | "substituicao" | "adicional" | "manter";

export interface ContractStatus {
  projectId: string;
  projectName: string;
  contractValue: Cents | null;
  budgetTotal: Cents;
  receivedCount: number;
  pendingCount: number;
  /** O que fazer: nada, definir sozinho (sem contrato) ou perguntar. */
  decision: "nenhuma" | "definir" | "perguntar";
}

export interface ContractPlanRow {
  op: "contrato" | "cancelar" | "reduzir" | "criar" | "aviso";
  description: string;
  amount: Cents;
  previousAmount: Cents | null;
  dueDate: string | null;
}

const uuid = z.string().uuid();
const modeSchema = z.enum(["definicao", "substituicao", "adicional", "manter"]);
const FORBIDDEN = { ok: false, error: "Só quem tem acesso ao financeiro altera o valor do contrato." } as const;

async function requireFinance() {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "finance") ? profile : null;
}

/** Depois de salvar um orçamento: o contrato do projeto precisa de decisão? */
export async function getBudgetContractStatusAction(budgetId: string): Promise<ContractStatus | null> {
  if (!(await requireFinance()) || !uuid.safeParse(budgetId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("budget_contract_status", { p_budget_id: budgetId });
  const row = data?.[0];
  if (error || !row?.project_id) return null;
  const budgetTotal = toCents(row.budget_total);
  const contractValue = row.contract_value == null ? null : toCents(row.contract_value);
  const synced = row.synced_total == null ? null : toCents(row.synced_total);
  let decision: ContractStatus["decision"] = "nenhuma";
  if (budgetTotal > 0) {
    if (contractValue == null || contractValue === 0) decision = "definir";
    else if (budgetTotal !== contractValue && budgetTotal !== synced) decision = "perguntar";
  }
  return {
    projectId: row.project_id,
    projectName: row.project_name,
    contractValue,
    budgetTotal,
    receivedCount: row.received_count,
    pendingCount: row.pending_count,
    decision,
  };
}

const planInput = z.object({
  projectId: uuid,
  mode: modeSchema,
  amount: z.number().int().min(0),
  regenerate: z.boolean(),
  description: z.string().trim().max(200),
});

type PlanInput = z.infer<typeof planInput>;

/** O que vai acontecer com o contrato e as parcelas — mostrado antes de confirmar. */
export async function previewContractChangeAction(input: PlanInput): Promise<{ ok: true; rows: ContractPlanRow[] } | { ok: false; error: string }> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise o valor." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_contract_plan", {
    p_project_id: parsed.data.projectId,
    p_mode: parsed.data.mode,
    p_amount: centsToNumber(parsed.data.amount),
    p_regenerate: parsed.data.regenerate,
    p_description: parsed.data.description,
  });
  if (error) return { ok: false, error: error.code === "22023" ? error.message : "Não foi possível montar o plano." };
  return {
    ok: true,
    rows: [...(data ?? [])]
      .sort((a, b) => a.seq - b.seq)
      .map((row) => ({
        op: row.op as ContractPlanRow["op"],
        description: row.description,
        amount: toCents(row.amount),
        previousAmount: row.previous_amount == null ? null : toCents(row.previous_amount),
        dueDate: row.due_date,
      })),
  };
}

/** Aplica a decisão: contrato, parcelas, histórico e activity_log numa transação só (no banco). */
export async function applyContractChangeAction(input: PlanInput & { budgetId: string | null; note: string }): Promise<ActionResult> {
  if (!(await requireFinance())) return FORBIDDEN;
  const parsed = planInput.extend({ budgetId: uuid.nullable(), note: z.string().trim().max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("project_apply_contract_change", {
    p_project_id: d.projectId,
    p_budget_id: d.budgetId,
    p_mode: d.mode,
    p_amount: centsToNumber(d.amount),
    p_regenerate: d.regenerate,
    p_description: d.description,
    p_note: d.note,
  });
  if (error) return { ok: false, error: error.code === "22023" || error.code === "42501" ? error.message : "Não foi possível aplicar a mudança." };
  revalidatePath(`/projetos/${d.projectId}`);
  revalidatePath("/financeiro");
  revalidatePath("/orcamentos", "layout");
  const messages: Record<ContractMode, string> = {
    definicao: "Valor do contrato definido pelo orçamento.",
    substituicao: "Valor do contrato substituído e parcelas reconciliadas.",
    adicional: "Serviço adicional somado ao contrato e parcela criada.",
    manter: "Orçamento registrado; o valor do contrato ficou como estava.",
  };
  return { ok: true, message: messages[d.mode] };
}
