"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NOTIFICATION_PREFERENCES, type NotificationPreferences } from "@/features/settings/queries";
import { companySettingsSchema, type CompanySettingsInput } from "@/features/settings/schemas";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const UNAUTHENTICATED = { ok: false, error: "Sessão expirada. Entre novamente." } as const;

const preferencesSchema = z.object(Object.fromEntries(NOTIFICATION_PREFERENCES.map((key) => [key, z.boolean()])) as Record<keyof NotificationPreferences, z.ZodBoolean>);

/** Preferências de notificação da própria pessoa (RLS: só a própria linha). O gatilho do banco as respeita. */
export async function saveNotificationPreferencesAction(values: NotificationPreferences): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = preferencesSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Preferências inválidas." };

  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ profile_id: profile.id, ...parsed.data }, { onConflict: "profile_id" });
  if (error) return { ok: false, error: "Não foi possível salvar as preferências." };
  revalidatePath("/configuracoes");
  return { ok: true, message: "Preferências salvas." };
}

/** Parâmetros da empresa — só diretoria/master (a RLS de company_settings repete a regra). */
export async function saveCompanySettingsAction(values: CompanySettingsInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!hasCapability(profile, "manageCompany")) return { ok: false, error: "Só a diretoria altera as configurações da empresa." };
  const parsed = companySettingsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({
      default_daily_hours: parsed.data.defaultDailyHours,
      default_workdays: [...new Set(parsed.data.defaultWorkdays)].sort(),
      healthy_margin_pct: parsed.data.healthyMarginPct,
      attention_margin_pct: parsed.data.attentionMarginPct,
    })
    .eq("id", true);
  if (error) return { ok: false, error: "Não foi possível salvar as configurações da empresa." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Configurações da empresa salvas." };
}

const financeAutomationSchema = z.object({
  invoice: z.boolean(),
  invoiceDaysBefore: z.number().int().min(0, "Use de 0 a 60 dias.").max(60, "Use de 0 a 60 dias."),
  weekly: z.boolean(),
  weeklyDow: z.number().int().min(0).max(6),
  monthly: z.boolean(),
  payments: z.boolean(),
  executorId: z.string().uuid().nullable(),
});

/** Pautas automáticas do financeiro — só diretoria/master (a RLS de company_settings repete). */
export async function saveFinanceAutomationAction(values: z.infer<typeof financeAutomationSchema>): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!hasCapability(profile, "manageCompany")) return { ok: false, error: "Só a diretoria altera as configurações da empresa." };
  const parsed = financeAutomationSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({
      finance_auto_invoice: d.invoice,
      finance_invoice_days_before: d.invoiceDaysBefore,
      finance_auto_weekly: d.weekly,
      finance_weekly_dow: d.weeklyDow,
      finance_auto_monthly: d.monthly,
      finance_auto_payments: d.payments,
      finance_executor_id: d.executorId,
    })
    .eq("id", true);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/configuracoes");
  return { ok: true, message: "Pautas automáticas do financeiro salvas." };
}
