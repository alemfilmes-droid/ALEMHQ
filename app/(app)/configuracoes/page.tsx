import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Building, ChevronRight, Moon, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { CommissionRulesCard } from "@/features/crm/components/commission-rules-card";
import { listCommissionRules } from "@/features/crm/queries";
import { CompanySettingsForm } from "@/features/settings/components/company-settings-form";
import { FinanceAutomationCard } from "@/features/settings/components/finance-automation-card";
import { NotificationPreferencesForm } from "@/features/settings/components/notification-preferences-form";
import { getCompanySettings, getNotificationPreferences } from "@/features/settings/queries";
import { GoogleCalendarSettings } from "@/features/google/components/google-calendar-settings";
import { ProspectSettingsCard } from "@/features/settings/components/prospect-settings-card";
import { hasCapability } from "@/lib/auth/permissions";
import { googleConfigured } from "@/lib/google/calendar.server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configurações" };

const SECTIONS = [
  { id: "perfil", label: "Perfil" },
  { id: "notificacoes", label: "Notificações" },
  { id: "aparencia", label: "Aparência" },
  { id: "google-agenda", label: "Google Agenda" },
] as const;

type SearchParams = Promise<{ google?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const canManageCompany = hasCapability(profile, "manageCompany");
  const supabase = await createClient();
  const [preferences, company, commissionRules, googleResult] = await Promise.all([
    getNotificationPreferences(profile.id),
    canManageCompany ? getCompanySettings() : Promise.resolve(null),
    canManageCompany ? listCommissionRules() : Promise.resolve([]),
    supabase.rpc("my_google_account"),
  ]);
  const [prospectRow, prospectPeople] = canManageCompany
    ? await Promise.all([
        supabase.from("company_settings").select("prospect_sdr_id, prospect_reviewer_id").eq("id", true).maybeSingle(),
        supabase.from("profiles").select("id, full_name").eq("is_active", true).neq("full_name", "").order("full_name"),
      ])
    : [null, null];
  const prospectSettings = { sdrId: prospectRow?.data?.prospect_sdr_id ?? null, reviewerId: prospectRow?.data?.prospect_reviewer_id ?? null };
  const prospectMembers = prospectPeople?.data ?? [];
  const googleRow = googleResult.data?.[0];
  const googleAccount = googleRow
    ? { email: googleRow.google_email ?? null, connectedAt: googleRow.connected_at, lastSyncAt: googleRow.last_sync_at ?? null, lastError: googleRow.last_error ?? null }
    : null;
  const sections = canManageCompany ? [...SECTIONS, { id: "empresa", label: "Empresa" } as const] : SECTIONS;

  return (
    <>
      <PageHeader panel="/configuracoes" title="Configurações." description="Seu perfil, suas notificações e, para a diretoria, os parâmetros da empresa." />

      <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Seções" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {sections.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 max-w-3xl gap-6">
          <Card variant="static" id="perfil" className="scroll-mt-24">
            <CardHeading
              icon={User}
              tone="neutral"
              title="Perfil"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/perfil">
                    Ver perfil completo
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              }
            />
            <CardContent className="space-y-6">
              <AvatarUploader userId={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} />
              <ProfileForm defaultValues={{ fullName: profile.full_name, phone: profile.phone ?? "" }} />
            </CardContent>
          </Card>

          <Card variant="static" id="notificacoes" className="scroll-mt-24">
            <CardHeading icon={Bell} tone="neutral" title="Notificações" />
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Escolha o que chega no sino. Desligado, a notificação nem é criada.</p>
              <NotificationPreferencesForm initial={preferences} />
            </CardContent>
          </Card>

          <Card variant="static" id="aparencia" className="scroll-mt-24">
            <CardHeading icon={Moon} tone="neutral" title="Aparência" action={<Badge variant="muted">Escuro</Badge>} />
            <CardContent>
              <p className="text-sm text-muted-foreground">
                O Além HQ é escuro por definição — é a linguagem da marca. O vermelho aparece só como acento: navegação ativa, bordas e brilhos
                discretos. Não há tema claro.
              </p>
            </CardContent>
          </Card>

          <GoogleCalendarSettings account={googleAccount} configured={googleConfigured()} result={params.google} />

          {canManageCompany && company ? (
            <div id="empresa" className="grid scroll-mt-24 gap-6">
              <Card variant="static">
                <CardHeading icon={Building} tone="accent" title="Empresa" action={<Badge variant="outline">Diretoria</Badge>} />
                <CardContent>
                  <CompanySettingsForm
                    initial={{
                      defaultDailyHours: company.defaultDailyHours,
                      defaultWorkdays: company.defaultWorkdays,
                      healthy: company.margin.healthy,
                      attention: company.margin.attention,
                    }}
                  />
                </CardContent>
              </Card>
              <FinanceAutomationCard initial={company.financeAutomation} members={prospectMembers} />
              <ProspectSettingsCard members={prospectMembers} initial={prospectSettings} />
              <CommissionRulesCard rules={commissionRules} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
