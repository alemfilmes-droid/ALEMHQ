"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageFreelancers } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { nullIfEmpty } from "@/lib/validations/company";
import { freelancerSchema, type FreelancerValues } from "@/lib/validations/freelancer";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const FORBIDDEN: ActionResult = { ok: false, error: "Só admin, diretoria, master e heads cadastram freelancers." };

function refresh() {
  revalidatePath("/equipe");
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
}

/** Cadastra (sem id) ou edita um freelancer. A RLS (can_manage_freelancers) confere de novo. */
export async function saveFreelancerAction(values: FreelancerValues, id?: string): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor || !canManageFreelancers(actor)) return FORBIDDEN;
  const parsed = freelancerSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  if (id && !z.string().uuid().safeParse(id).success) return { ok: false, error: "Freelancer inválido." };

  const row = {
    full_name: parsed.data.fullName,
    phone: nullIfEmpty(parsed.data.phone),
    email: nullIfEmpty(parsed.data.email),
    functions: parsed.data.functions,
    city: nullIfEmpty(parsed.data.city),
    notes: nullIfEmpty(parsed.data.notes),
  };

  const supabase = await createClient();
  const { error } = id ? await supabase.from("freelancers").update(row).eq("id", id) : await supabase.from("freelancers").insert(row);
  if (error) return { ok: false, error: "Não foi possível salvar o freelancer." };

  refresh();
  return { ok: true, message: id ? "Freelancer atualizado." : "Freelancer cadastrado." };
}

/** Desativar (some da lista de escolha nas pautas) ou reativar. Não há exclusão: o histórico fica. */
export async function setFreelancerActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor || !canManageFreelancers(actor)) return FORBIDDEN;
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Freelancer inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("freelancers").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível atualizar o freelancer." };

  refresh();
  return { ok: true, message: active ? "Freelancer reativado." : "Freelancer desativado." };
}
