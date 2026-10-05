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
  /** Pautas automáticas do financeiro. */
  financeAutomation: FinanceAutomation;
}

export interface FinanceAutomation {
  invoice: boolean;
  invoiceDaysBefore: number;
  weekly: boolean;
  weeklyDow: number;
  monthly: boolean;
  payments: boolean;
  executorId: string | null;
}

export const DEFAULT_FINANCE_AUTOMATION: FinanceAutomation = {
  invoice: true,
  invoiceDaysBefore: 5,
  weekly: true,
  weeklyDow: 6,
  monthly: true,
  payments: true,
  executorId: null,
};

const FALLBACK: CompanySettingsView = {
  defaultDailyHours: 8,
  defaultWorkdays: [1, 2, 3, 4, 5],
  margin: DEFAULT_MARGIN_THRESHOLDS,
  updatedAt: null,
  financeAutomation: DEFAULT_FINANCE_AUTOMATION,
};

function toView(row: CompanySettings): CompanySettingsView {
  return {
    defaultDailyHours: Number(row.default_daily_hours),
    defaultWorkdays: row.default_workdays,
    margin: { healthy: Number(row.healthy_margin_pct), attention: Number(row.attention_margin_pct) },
    updatedAt: row.updated_at,
    financeAutomation: {
      invoice: row.finance_auto_invoice ?? true,
      invoiceDaysBefore: row.finance_invoice_days_before ?? 5,
      weekly: row.finance_auto_weekly ?? true,
      weeklyDow: row.finance_weekly_dow ?? 6,
      monthly: row.finance_auto_monthly ?? true,
      payments: row.finance_auto_payments ?? true,
      executorId: row.finance_executor_id ?? null,
    },
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
