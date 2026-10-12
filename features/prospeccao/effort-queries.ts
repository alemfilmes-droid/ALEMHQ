import "server-only";
import { addDays, dayRangeIso, startOfWeek, todayInAppZone } from "@/lib/calendar";
import { meetingsInWeek, touchesOnDay } from "@/lib/prospeccao/effort";
import { createClient } from "@/lib/supabase/server";

export interface EffortPerson {
  id: string;
  name: string;
  touchesToday: number;
  meetingsWeek: number;
}

export interface Effort {
  today: string;
  touchTarget: number;
  meetingTarget: number;
  people: EffortPerson[];
}

/**
 * Metas de esforço (spec 7.3): toques enviados hoje e reuniões marcadas nesta semana, por pessoa do
 * comercial, a partir do histórico (a RLS mostra o que cada um pode ver). `onlyId` restringe a uma.
 */
export async function loadEffort(onlyId?: string): Promise<Effort> {
  const supabase = await createClient();
  const today = todayInAppZone();
  const week = dayRangeIso(startOfWeek(today), addDays(startOfWeek(today), 7));
  const day = dayRangeIso(today, addDays(today, 1));

  const [settings, touches, meetings, squad] = await Promise.all([
    supabase.from("prospect_settings").select("daily_touch_target, weekly_meeting_target").eq("id", true).maybeSingle(),
    // Meta de toques: conta pelo horário efetivo e ignora os riscados.
    supabase.from("prospect_touch_logs").select("sent_at, sent_by").is("deleted_at", null).gte("sent_at", day.from).lt("sent_at", day.to),
    supabase.from("deal_meetings").select("created_at, created_by").gte("created_at", week.from).lt("created_at", week.to),
    supabase.from("profile_squads").select("profile:profiles!inner(id, full_name, is_active)").eq("squad", "comercial").eq("profile.is_active", true),
  ]);

  const touchList = (touches.data ?? []).map((row) => ({ at: row.sent_at, by: row.sent_by }));
  const meetingList = (meetings.data ?? []).map((row) => ({ at: row.created_at, by: row.created_by }));
  const people = (squad.data ?? [])
    .map((row) => row.profile)
    .filter((person) => !onlyId || person.id === onlyId)
    .map((person) => ({
      id: person.id,
      name: person.full_name,
      touchesToday: touchesOnDay(touchList, person.id, today),
      meetingsWeek: meetingsInWeek(meetingList, person.id, today),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    today,
    touchTarget: settings.data?.daily_touch_target ?? 0,
    meetingTarget: settings.data?.weekly_meeting_target ?? 0,
    people,
  };
}
