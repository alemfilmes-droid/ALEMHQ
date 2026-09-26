import "server-only";
import { cache } from "react";
import { DEFAULT_MARGIN_THRESHOLDS, type MarginThresholds } from "@/lib/margin";
import { createClient } from "@/lib/supabase/server";
import type { CompanySettings, UserSettings } from "@/types";

export interface CompanySettingsView {
  defaultDailyHours: number;
  defaultWorkdays: number[];
  margin: MarginThresholds;
  updatedAt: string | null;
}

const FALLBACK: CompanySettingsView = {
  defaultDailyHours: 8,
  defaultWorkdays: [1, 2, 3, 4, 5],
  margin: DEFAULT_MARGIN_THRESHOLDS,
  updatedAt: null,
};

function toView(row: CompanySettings): CompanySettingsView {
  return {
    defaultDailyHours: Number(row.default_daily_hours),
    defaultWorkdays: row.default_workdays,
    margin: { healthy: Number(row.healthy_margin_pct), attention: Number(row.attention_margin_pct) },
    updatedAt: row.updated_at,
  };
}

/** Parâmetros da empresa (linha única). Sem a linha (migração não aplicada), os padrões de sempre. */
export const getCompanySettings = cache(async (): Promise<CompanySettingsView> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", true).maybeSingle();
  return !error && data ? toView(data) : FALLBACK;
});

export const NOTIFICATION_PREFERENCES = [
  "notify_pautas",
  "notify_projetos",
  "notify_agenda",
  "notify_comercial",
  "notify_financeiro",
  "notify_avisos",
  "notify_banco_horas",
] as const satisfies readonly (keyof UserSettings)[];
export type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];
export type NotificationPreferences = Record<NotificationPreference, boolean>;

const ALL_ON = Object.fromEntries(NOTIFICATION_PREFERENCES.map((key) => [key, true])) as NotificationPreferences;

/** Preferências de notificação da pessoa. Sem linha: tudo ligado (é o que o gatilho do banco assume). */
export async function getNotificationPreferences(profileId: string): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("*").eq("profile_id", profileId).maybeSingle();
  if (!data) return ALL_ON;
  return Object.fromEntries(NOTIFICATION_PREFERENCES.map((key) => [key, data[key]])) as NotificationPreferences;
}
