"use server";

import { z } from "zod";
import { FORBIDDEN, firstIssue, prospectingManager, revalidateProspecting } from "@/features/prospeccao/guard";
import { playbookSchema, type PlaybookInput } from "@/features/prospeccao/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return slug || "playbook";
}

async function createPlaybook(supabase: Supabase, fields: Omit<z.output<typeof playbookSchema>, "id" | "houseSuggestionIds">) {
  const { data: existing } = await supabase.from("prospect_playbooks").select("slug, position");
  const rows = existing ?? [];
  const base = slugify(fields.name);
  let slug = base;
  for (let n = 2; rows.some((row) => row.slug === slug); n += 1) slug = `${base}-${n}`;
  const position = Math.max(0, ...rows.map((row) => row.position)) + 1;
  return supabase
    .from("prospect_playbooks")
    .insert({
      slug,
      position,
      name: fields.name,
      audience: fields.audience,
      cadence_type: fields.cadenceType,
      touch_zero_variant: fields.touchZeroVariant,
      crm_goal: fields.crmGoal,
      uses_house_client_script: fields.usesHouseClientScript,
      link_base: fields.linkBase,
      link_appends_school_param: fields.linkAppendsSchoolParam,
      case_text: fields.caseText,
    })
    .select("id")
    .single();
}

/** Cria ou edita um playbook e regrava as sugestões de "cliente da casa" dele. */
export async function savePlaybookAction(values: PlaybookInput): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = playbookSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, houseSuggestionIds, ...fields } = parsed.data;
  const supabase = await createClient();

  let playbookId = id;
  if (playbookId) {
    const { data, error } = await supabase
      .from("prospect_playbooks")
      .update({
        name: fields.name,
        audience: fields.audience,
        cadence_type: fields.cadenceType,
        touch_zero_variant: fields.touchZeroVariant,
        crm_goal: fields.crmGoal,
        uses_house_client_script: fields.usesHouseClientScript,
        link_base: fields.linkBase,
        link_appends_school_param: fields.linkAppendsSchoolParam,
        case_text: fields.caseText,
      })
      .eq("id", playbookId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "Não foi possível salvar o playbook." };
  } else {
    const { data, error } = await createPlaybook(supabase, fields);
    if (error || !data) return { ok: false, error: "Não foi possível criar o playbook." };
    playbookId = data.id;
  }

  const suggestions = [...new Set(houseSuggestionIds)].filter((suggested) => suggested !== playbookId);
  const removed = await supabase.from("prospect_house_suggestions").delete().eq("closed_playbook_id", playbookId);
  if (removed.error) return { ok: false, error: "Playbook salvo, mas as sugestões de cliente da casa não foram atualizadas." };
  if (suggestions.length) {
    const inserted = await supabase
      .from("prospect_house_suggestions")
      .insert(suggestions.map((suggested, index) => ({ closed_playbook_id: playbookId, suggested_playbook_id: suggested, position: index + 1 })));
    if (inserted.error) return { ok: false, error: "Playbook salvo, mas as sugestões de cliente da casa não foram atualizadas." };
  }

  revalidateProspecting();
  return { ok: true, message: id ? "Playbook salvo." : "Playbook criado. Escreva os scripts dele na aba Scripts." };
}

export async function setPlaybookActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Playbook inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospect_playbooks").update({ active }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível alterar o playbook." };
  revalidateProspecting();
  return { ok: true, message: active ? "Playbook ativado." : "Playbook desativado." };
}
