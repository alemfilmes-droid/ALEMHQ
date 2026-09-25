import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { closeStaleTimeSessionsAction } from "@/features/time-tracking/actions";
import { AutoRefresh } from "@/features/time-tracking/components/auto-refresh";
import { BalanceChart } from "@/features/time-tracking/components/balance-chart";
import { BalanceKpiRow } from "@/features/time-tracking/components/balance-kpis";
import { EntryDialog } from "@/features/time-tracking/components/entry-dialog";
import { ExportPdfButton } from "@/features/time-tracking/components/export-pdf-button";
import { ExtractList } from "@/features/time-tracking/components/extract-list";
import { MonthSelector } from "@/features/time-tracking/components/month-selector";
import { TeamTable } from "@/features/time-tracking/components/team-table";
import { currentYearMonth, getBalanceChart, getBalanceKpis, getExtractDays, getTeamStatus } from "@/features/time-tracking/queries";
import { canManageTimeTracking } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Banco de Horas" };

type SearchParams = Promise<{ aba?: string; mes?: string }>;

const YEAR_MONTH = /^\d{4}-\d{2}$/;

export default async function BancoDeHorasPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  // Fogo-e-esqueça: fecha sessões esquecidas de qualquer pessoa, sem bloquear a página.
  void closeStaleTimeSessionsAction();
  const canSeeTeam = canManageTimeTracking(profile);

  const params = await searchParams;
  const yearMonth = params.mes && YEAR_MONTH.test(params.mes) ? params.mes : currentYearMonth();
  const tab = params.aba === "equipe" && canSeeTeam ? "equipe" : "minha";
  const tabHref = (key: string) => `/banco-de-horas?aba=${key}&mes=${yearMonth}`;

  return (
    <>
      <AutoRefresh />
      <PageHeader
        panel="/banco-de-horas"
        eyebrow="Empresa"
        title="Banco de horas."
        description="Seus registros de ponto, saldo e carga horária."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <EntryDialog mode="create" />
            <ExportPdfButton />
          </div>
        }
      />

      <div className="space-y-6">
        {canSeeTeam ? (
          <div className="print:hidden">
            <LinkTabs
              label="Seções do banco de horas"
              tabs={[
                { href: tabHref("minha"), label: "Minha", active: tab === "minha" },
                { href: tabHref("equipe"), label: "Equipe", active: tab === "equipe" },
              ]}
            />
          </div>
        ) : null}

        <div className="print:hidden">
          <Suspense>
            <MonthSelector yearMonth={yearMonth} />
          </Suspense>
        </div>

        {tab === "equipe" ? <EquipeTab yearMonth={yearMonth} /> : <MinhaTab profileId={profile.id} yearMonth={yearMonth} />}
      </div>
    </>
  );
}

async function MinhaTab({ profileId, yearMonth }: { profileId: string; yearMonth: string }) {
  const [kpis, chart, days] = await Promise.all([
    getBalanceKpis(profileId, yearMonth),
    getBalanceChart(profileId),
    getExtractDays(profileId, yearMonth),
  ]);

  return (
    <div className="space-y-6">
      <BalanceKpiRow kpis={kpis} />
      <BalanceChart data={chart} />
      <ExtractList days={days} />
    </div>
  );
}

async function EquipeTab({ yearMonth }: { yearMonth: string }) {
  const members = await getTeamStatus(yearMonth);
  return <TeamTable members={members} yearMonth={yearMonth} />;
}
