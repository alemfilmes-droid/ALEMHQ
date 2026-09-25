import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { HomeAgendaCard } from "@/features/agenda/components/home-agenda-card";
import { DirectorCommercialCard, MyCommercialDayCard } from "@/features/crm/components/home-commercial-cards";
import { syncCrmAlertsAction } from "@/features/crm/actions";
import { checkOverdueFinanceAction } from "@/features/finance/actions";
import { HomeFinanceCard } from "@/features/finance/components/home-finance-card";
import { PautaHomeCards } from "@/features/pautas/components/home-cards";
import { closeStaleTimeSessionsAction } from "@/features/time-tracking/actions";
import { PontoCard } from "@/features/time-tracking/components/ponto-card";
import { canManageAllDeals, hasCapability } from "@/lib/auth/permissions";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { requireProfile } from "@/lib/auth/session";
import { formatLongDate, getFirstName, getGreeting } from "@/lib/format";
import { SQUAD_TONE } from "@/lib/status";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage() {
  const profile = await requireProfile();
  // Fogo-e-esqueça: não bloqueiam a renderização nem falham a página se a RPC der erro.
  void checkOverdueFinanceAction();
  void closeStaleTimeSessionsAction();
  if (hasCapability(profile, "crm")) void syncCrmAlertsAction();

  return (
    <>
      <PageHeader
        panel="/inicio"
        eyebrow={formatLongDate()}
        title={`${getGreeting()}, ${getFirstName(profile.full_name)}.`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {profile.job_title ? <span className="font-semibold text-foreground">{profile.job_title}</span> : null}
            {profile.squads.map((squad) => (
              <Badge key={squad} variant="muted">
                <StatusDot tone={SQUAD_TONE[squad]} />
                {SQUAD_LABELS[squad]}
              </Badge>
            ))}
          </span>
        }
      />

      <section aria-label="Resumo" className="card-grid-lg">
        <PontoCard profileId={profile.id} />
        <PautaHomeCards profileId={profile.id} />

        <HomeAgendaCard />

        {hasCapability(profile, "crmOverview") ? <DirectorCommercialCard /> : null}
        {hasCapability(profile, "crmWorkday") ? <MyCommercialDayCard profileId={profile.id} showCommissions={!canManageAllDeals(profile)} /> : null}

        {hasCapability(profile, "canSeeFinanceHomeCard") ? <HomeFinanceCard /> : null}
      </section>
    </>
  );
}
