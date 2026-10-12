"use server";

import { z } from "zod";
import { FORBIDDEN, firstIssue, prospectingManager, revalidateProspecting } from "@/features/prospeccao/guard";
import { holidaySchema, type HolidayInput } from "@/features/prospeccao/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/** Ano de referência dos feriados recorrentes (só dia/mês contam; 2000 é bissexto, aceita 29/02). */
const RECURRING_YEAR = "2000";

export async function addHolidayAction(values: HolidayInput): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = holidaySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { date, name, scope, recurring } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("prospect_holidays").insert({
    holiday_date: recurring ? `${RECURRING_YEAR}${date.slice(4)}` : date,
    name,
    scope,
    recurring,
  });
  if (error?.code === "23505") return { ok: false, error: "Já existe um feriado nessa data com essa abrangência." };
  if (error) return { ok: false, error: "Não foi possível adicionar o feriado." };
  revalidateProspecting();
  return { ok: true, message: "Feriado adicionado." };
}

const idSchema = z.string().uuid();

export async function removeHolidayAction(id: string): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Feriado inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospect_holidays").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível remover o feriado." };
  revalidateProspecting();
  return { ok: true, message: "Feriado removido." };
}

export async function confirmHolidayAction(id: string): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Feriado inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospect_holidays").update({ needs_confirmation: false }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível confirmar o feriado." };
  revalidateProspecting();
  return { ok: true, message: "Feriado confirmado." };
}

/** Ponto facultativo: liga/desliga "Pular na prospecção" (desligado = o dia conta como útil). */
export async function setHolidaySkipAction(id: string, skip: boolean): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Feriado inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospect_holidays").update({ skip_prospecting: skip }).eq("id", id).eq("optional", true).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível alterar o ponto facultativo." };
  revalidateProspecting();
  return { ok: true, message: skip ? "A cadência pula este dia." : "Este dia passa a contar como útil." };
}
