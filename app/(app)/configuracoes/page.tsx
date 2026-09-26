import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Building, CalendarSync, ChevronRight, Lock, Moon, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { CommissionRulesCard } from "@/features/crm/components/commission-rules-card";
import { listCommissionRules } from "@/features/crm/queries";
import { CompanySettingsForm } from "@/features/settings/components/company-settings-form";
import { NotificationPreferencesForm } from "@/features/settings/components/notification-preferences-form";
import { getCompanySettings, getNotificationPreferences } from "@/features/settings/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configurações" };

const SECTIONS = [
  { id: "perfil", label: "Perfil" },
  { id: "notificacoes", label: "Notificações" },
  { id: "aparencia", label: "Aparência" },
  { id: "google-agenda", label: "Google Agenda" },
] as const;

export default async function SettingsPage() {
  const profile = await requireProfile();
  const canManageCompany = hasCapability(profile, "manageCompany");
  const [preferences, company, commissionRules] = await Promise.all([
    getNotificationPreferences(profile.id),
    canManageCompany ? getCompanySettings() : Promise.resolve(null),
    canManageCompany ? listCommissionRules() : Promise.resolve([]),
  ]);
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

          {/*
            Reservado para a sincronização com o Google Agenda, que será ligada DEPOIS da configuração do
            domínio de produção (o OAuth exige o domínio). O banco já tem as colunas (commitments.
            google_event_id, google_calendar_id, google_sync_status) — nenhum código de OAuth existe ainda.
          */}
          <section id="google-agenda" aria-labelledby="google-agenda-title" className="scroll-mt-24 rounded-lg border border-dashed border-border-strong bg-surface p-6 opacity-80">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-raised">
                <CalendarSync className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="google-agenda-title" className="section-title">
                    Google Agenda — conectar
                  </h2>
                  <Badge variant="outline">Disponível após a configuração do domínio</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cada pessoa vai conectar a própria conta Google. Os compromissos do Além HQ (reuniões, captações, entregas e pautas agendadas) passam
                  a aparecer na sua agenda do Google, e as mudanças feitas lá voltam para cá. A conexão é liberada assim que o domínio de produção
                  estiver configurado.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-[13px] text-subtle">
                  <li>A conexão é individual: ninguém conecta a conta de outra pessoa.</li>
                  <li>Compromissos privados continuam aparecendo como “Ocupado” para o resto da equipe.</li>
                  <li>Você pode desconectar a qualquer momento.</li>
                </ul>
              </div>
              <Button variant="secondary" disabled className="shrink-0">
                <Lock aria-hidden />
                Conectar conta Google
              </Button>
            </div>
          </section>

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
              <CommissionRulesCard rules={commissionRules} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
