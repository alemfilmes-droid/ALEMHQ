import type { Metadata } from "next";
import { UserAvatar } from "@/components/ui/avatar";
import { SquadBadge } from "@/components/ui/squad-badge";
import { HomeAgendaCard } from "@/features/agenda/components/home-agenda-card";
import { DirectorCommercialCard, MyCommercialDayCard } from "@/features/crm/components/home-commercial-cards";
import { syncCrmAlertsAction } from "@/features/crm/actions";
import { EssenciaCards } from "@/features/essencia/components/essencia-cards";
import { checkOverdueFinanceAction } from "@/features/finance/actions";
import { HomeFinanceCard } from "@/features/finance/components/home-finance-card";
import { MyGoalsHighlight, TeamGoalsCard } from "@/features/goals/components/home-goal-cards";
import { PautaHomeCards } from "@/features/pautas/components/home-cards";
import { closeStaleTimeSessionsAction } from "@/features/time-tracking/actions";
import { PontoCard } from "@/features/time-tracking/components/ponto-card";
import { ORG_LEVEL_LABELS } from "@/lib/auth/org";
import { canManageAllDeals, hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { formatLongDate, getFirstName, getGreeting } from "@/lib/format";
import { SQUAD_PRIORITY } from "@/lib/theme";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage() {
  const profile = await requireProfile();
  // Fogo-e-esqueça: não bloqueiam a renderização nem falham a página se a RPC der erro.
  void checkOverdueFinanceAction();
  void closeStaleTimeSessionsAction();
  if (hasCapability(profile, "crm")) void syncCrmAlertsAction();

  const squads = SQUAD_PRIORITY.filter((squad) => profile.squads.includes(squad));

  return (
    <>
      {/*
        Cabeçalho em card: superfície em gradiente com um brilho vermelho discreto no canto (acento da
        marca em baixa opacidade), foto com o anel do squad principal, saudação, cargo e squads.
      */}
      <header className="card-surface card-static hero-surface relative mb-10 overflow-hidden rounded-xl p-6 sm:p-8">
        <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/40 to-transparent" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <UserAvatar name={profile.full_name} src={profile.avatar_url} squads={profile.squads} className="size-20 text-lg sm:size-24" />
          <div className="min-w-0 space-y-2">
            <p className="eyebrow">{formatLongDate()}</p>
            <h1 className="page-title break-words">
              {getGreeting()}, {getFirstName(profile.full_name)}.
            </h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {profile.job_title ? <span className="text-sm font-semibold text-foreground">{profile.job_title}</span> : null}
              {profile.job_title ? <span className="text-subtle">·</span> : null}
              <span className="text-sm text-muted-foreground">{ORG_LEVEL_LABELS[profile.org_level]}</span>
              {squads.map((squad) => (
                <SquadBadge key={squad} squad={squad} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Resumo" className="card-grid-lg gap-5">
        {/* Meta ativa em destaque, antes de tudo. */}
        <MyGoalsHighlight profileId={profile.id} className="card-span-2" />
        <PontoCard profileId={profile.id} />
        <PautaHomeCards profileId={profile.id} />
        <HomeAgendaCard />

        {hasCapability(profile, "crmOverview") ? <DirectorCommercialCard canSeeFinance={hasCapability(profile, "finance")} /> : null}
        {hasCapability(profile, "crmWorkday") ? <MyCommercialDayCard profileId={profile.id} showCommissions={!canManageAllDeals(profile) && hasCapability(profile, "finance")} /> : null}

        {hasCapability(profile, "manageCompany") ? <TeamGoalsCard /> : null}
        {hasCapability(profile, "canSeeFinanceHomeCard") ? <HomeFinanceCard /> : null}
      </section>

      <EssenciaCards />
    </>
  );
}
