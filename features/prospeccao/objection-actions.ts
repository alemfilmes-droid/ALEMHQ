"use server";

import { z } from "zod";
import { FORBIDDEN, firstIssue, prospectingManager, revalidateProspecting } from "@/features/prospeccao/guard";
import { objectionSchema, type ObjectionInput } from "@/features/prospeccao/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

export async function saveObjectionAction(values: ObjectionInput): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = objectionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, shortcut, label, responseBody, hqAction } = parsed.data;
  const fields = { shortcut, label, response_body: responseBody, hq_action: hqAction };
  const supabase = await createClient();

  let result;
  if (id) {
    result = await supabase.from("prospect_objections").update(fields).eq("id", id).select("id");
  } else {
    const { data: last } = await supabase.from("prospect_objections").select("position").order("position", { ascending: false }).limit(1);
    result = await supabase
      .from("prospect_objections")
      .insert({ ...fields, position: (last?.[0]?.position ?? 0) + 1 })
      .select("id");
  }
  if (result.error?.code === "23505") return { ok: false, error: `O atalho ${shortcut} já está em uso.` };
  if (result.error || !result.data?.length) return { ok: false, error: "Não foi possível salvar a objeção." };
  revalidateProspecting();
  return { ok: true, message: id ? "Objeção salva." : "Objeção criada." };
}

export async function setObjectionActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Objeção inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospect_objections").update({ active }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível alterar a objeção." };
  revalidateProspecting();
  return { ok: true, message: active ? "Objeção ativada." : "Objeção desativada." };
}
