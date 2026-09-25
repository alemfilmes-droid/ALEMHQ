import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AutoRefresh } from "@/features/time-tracking/components/auto-refresh";
import { BalanceChart } from "@/features/time-tracking/components/balance-chart";
import { BalanceKpiRow } from "@/features/time-tracking/components/balance-kpis";
import { ExtractList } from "@/features/time-tracking/components/extract-list";
import { MonthSelector } from "@/features/time-tracking/components/month-selector";
import { WorkScheduleDialog } from "@/features/time-tracking/components/work-schedule-dialog";
import { currentYearMonth, getBalanceChart, getBalanceKpis, getExtractDays, getWorkSchedule } from "@/features/time-tracking/queries";
import { canManageTimeTracking } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Banco de Horas" };

type Params = Promise<{ profileId: string }>;
type SearchParams = Promise<{ mes?: string }>;

const YEAR_MONTH = /^\d{4}-\d{2}$/;

/** Extrato de outra pessoa — só diretoria/admin, e sempre somente leitura (a RLS já bloqueia editar/excluir de qualquer forma). */
export default async function PersonExtractPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const profile = await requireProfile();
  if (!canManageTimeTracking(profile)) redirect("/banco-de-horas");

  const { profileId } = await params;
  const { mes } = await searchParams;
  const yearMonth = mes && YEAR_MONTH.test(mes) ? mes : currentYearMonth();

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("full_name, job_title, created_at").eq("id", profileId).maybeSingle();
  if (!target) notFound();

  const [kpis, chart, days, schedule] = await Promise.all([
    getBalanceKpis(profileId, yearMonth),
    getBalanceChart(profileId),
    getExtractDays(profileId, yearMonth),
    getWorkSchedule(profileId),
  ]);

  return (
    <>
      <AutoRefresh />
      <PageHeader
        panel="/banco-de-horas"
        eyebrow="Banco de horas · Equipe"
        title={`${target.full_name}.`}
        description={target.job_title ?? undefined}
        actions={
          <WorkScheduleDialog profileId={profileId} fullName={target.full_name} schedule={schedule ?? null} profileCreatedAt={target.created_at} />
        }
      />
      <div className="space-y-6">
        <Suspense>
          <MonthSelector yearMonth={yearMonth} />
        </Suspense>
        <BalanceKpiRow kpis={kpis} />
        <BalanceChart data={chart} />
        <ExtractList days={days} readOnly />
      </div>
    </>
  );
}
