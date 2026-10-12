"use server";

import { FORBIDDEN, firstIssue, prospectingManager, revalidateProspecting } from "@/features/prospeccao/guard";
import { cadenceSchema, generalSettingsSchema, goalMappingSchema, type CadenceInput, type GeneralSettingsInput } from "@/features/prospeccao/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

export async function saveGeneralSettingsAction(values: GeneralSettingsInput): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = generalSettingsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospect_settings")
    .update({
      meeting_duration_minutes: d.meetingDurationMinutes,
      meeting_windows: [...d.meetingWindows].sort((a, b) => a.start.localeCompare(b.start)),
      daily_touch_target: d.dailyTouchTarget,
      weekly_meeting_target: d.weeklyMeetingTarget,
      house_client_delay_days: d.houseClientDelayDays,
    })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível salvar." };
  revalidateProspecting();
  return { ok: true, message: "Configurações gerais salvas." };
}

export async function saveCadenceAction(values: CadenceInput): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = cadenceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospect_cadences")
    .update({ touch_offsets: parsed.data.touchOffsets, reactivation_days: parsed.data.reactivationDays })
    .eq("cadence_type", parsed.data.cadenceType)
    .select("cadence_type");
  if (error || !data?.length) return { ok: false, error: "Não foi possível salvar a cadência." };
  revalidateProspecting();
  return { ok: true, message: "Cadência salva." };
}

export async function saveGoalMappingAction(values: { playbookId: string; goalId: string | null }): Promise<ActionResult> {
  if (!(await prospectingManager())) return FORBIDDEN;
  const parsed = goalMappingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Escolha uma meta válida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospect_playbooks")
    .update({ suggested_goal_id: parsed.data.goalId })
    .eq("id", parsed.data.playbookId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível salvar a meta sugerida." };
  revalidateProspecting();
  return { ok: true, message: parsed.data.goalId ? "Meta sugerida salva." : "Playbook sem meta sugerida." };
}
