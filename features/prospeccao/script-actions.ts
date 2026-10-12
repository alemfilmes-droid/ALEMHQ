"use server";

import { FORBIDDEN, firstIssue, prospectingManager, revalidateProspecting } from "@/features/prospeccao/guard";
import { scriptSchema, type ScriptInput } from "@/features/prospeccao/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * Salva o texto de um script. Vale só para os próximos envios: o histórico do lead guarda o texto
 * já renderizado (Módulo 3), então nada do que já foi enviado muda.
 */
export async function saveScriptAction(values: ScriptInput): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = scriptSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const script = parsed.data;
  const supabase = await createClient();

  const { data, error } = script.id
    ? await supabase.from("prospect_scripts").update({ body: script.body }).eq("id", script.id).select("id")
    : await supabase
        .from("prospect_scripts")
        .insert({
          playbook_id: script.playbookId,
          kind: script.kind,
          touch_number: script.touchNumber,
          touch_zero_variant: script.touchZeroVariant,
          audience: script.audience,
          body: script.body,
        })
        .select("id");
  if (error?.code === "23505") return { ok: false, error: "Esse script já existe. Recarregue a página." };
  if (error || !data?.length) return { ok: false, error: "Não foi possível salvar o script." };
  revalidateProspecting();
  return { ok: true, message: "Script salvo. Vale para os próximos envios." };
}
