import "server-only";
import { meetingWindowSchema } from "@/features/prospeccao/schemas";
import type { GeneralSettings, ProspectingConfig } from "@/features/prospeccao/types";
import { todayInAppZone } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

const EMPTY_GENERAL: GeneralSettings = { meetingDurationMinutes: 45, meetingWindows: [], dailyTouchTarget: 0, weeklyMeetingTarget: 0, houseClientDelayDays: 7 };

function parseWindows(value: Json): GeneralSettings["meetingWindows"] {
  const parsed = meetingWindowSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Tudo o que Configurações > Prospecção mostra. A RLS libera a leitura para usuários ativos. */
export async function getProspectingConfig(): Promise<ProspectingConfig> {
  const supabase = await createClient();
  const [settings, playbooks, suggestions, scripts, cadences, objections, holidays, goals] = await Promise.all([
    supabase.from("prospect_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("prospect_playbooks").select("*").order("position").order("created_at"),
    supabase.from("prospect_house_suggestions").select("*").order("position"),
    supabase.from("prospect_scripts").select("*"),
    supabase.from("prospect_cadences").select("*").order("cadence_type"),
    supabase.from("prospect_objections").select("*").order("position").order("shortcut"),
    supabase.from("prospect_holidays").select("*").order("holiday_date"),
    supabase.from("goals").select("id, title, starts_on, ends_on").eq("status", "ativa").gte("ends_on", todayInAppZone()).order("ends_on"),
  ]);

  const failed = [settings, playbooks, suggestions, scripts, cadences, objections, holidays, goals].find((result) => result.error);
  if (failed?.error) throw new Error(`Não foi possível carregar a prospecção: ${failed.error.message}`);

  const row = settings.data;
  const general: GeneralSettings = row
    ? {
        meetingDurationMinutes: row.meeting_duration_minutes,
        meetingWindows: parseWindows(row.meeting_windows),
        dailyTouchTarget: row.daily_touch_target,
        weeklyMeetingTarget: row.weekly_meeting_target,
        houseClientDelayDays: row.house_client_delay_days,
      }
    : EMPTY_GENERAL;

  const suggestionRows = suggestions.data ?? [];
  return {
    general,
    playbooks: (playbooks.data ?? []).map((playbook) => ({
      ...playbook,
      houseSuggestionIds: suggestionRows.filter((item) => item.closed_playbook_id === playbook.id).map((item) => item.suggested_playbook_id),
    })),
    scripts: scripts.data ?? [],
    cadences: cadences.data ?? [],
    objections: objections.data ?? [],
    holidays: holidays.data ?? [],
    goals: (goals.data ?? []).map((goal) => ({ id: goal.id, title: goal.title, startsOn: goal.starts_on, endsOn: goal.ends_on })),
  };
}
