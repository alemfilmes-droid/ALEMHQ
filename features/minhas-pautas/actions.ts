"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { nullIfEmpty } from "@/lib/validations/company";
import { createStandaloneTaskSchema, type CreateStandaloneTaskValues } from "@/lib/validations/pauta";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Tables } from "@/types";

const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };

/** Tarefa avulsa: pessoal, sem cliente nem projeto — só aparece no quadro de quem a criou. */
export async function createStandaloneTaskAction(values: CreateStandaloneTaskValues): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = createStandaloneTaskSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("pautas").insert({
    title: parsed.data.title,
    briefing: nullIfEmpty(parsed.data.description),
    due_date: nullIfEmpty(parsed.data.dueDate),
    priority: parsed.data.priority,
    // O trigger pautas_set_squad valida que o squad é da pessoa (ou escolhe o principal dela).
    squad: parsed.data.squad || undefined,
    is_standalone: true,
    created_for: profile.id,
    lead_id: profile.id,
    current_assignee_id: profile.id,
  } as Tables["pautas"]["Insert"]);
  if (error) return { ok: false, error: "Não foi possível criar a tarefa." };

  revalidatePath("/minhas-pautas");
  revalidatePath("/inicio");
  return { ok: true, message: "Tarefa criada." };
}
