import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dateOnlyOf, formatWeekday, fortalezaDayBounds, todayDateOnly } from "@/features/time-tracking/format";
import type { BalanceKpis, ExtractDay, OpenSessionState, TeamMemberStatus } from "@/features/time-tracking/types";
import type { Squad, TimeDailySummaryRow, TimeEntry } from "@/types";

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** "2026-03" → intervalo yyyy-mm-dd (inclusivo) do mês inteiro. */
export function monthRange(yearMonth: string): { from: string; to: string; year: number; month: number } {
  const [year = 0, month = 1] = yearMonth.split("-").map(Number);
  return { from: `${yearMonth}-01`, to: `${yearMonth}-${pad(daysInMonth(year, month))}`, year, month };
}

export function currentYearMonth(): string {
  return todayDateOnly().slice(0, 7);
}

/** Estado do dia para o card "Ponto do dia": entradas/saídas de hoje e se há sessão em aberto. */
export async function getOpenSessionState(profileId: string): Promise<OpenSessionState> {
  const supabase = await createClient();
  const today = todayDateOnly();
  const { startIso, endIsoExclusive } = fortalezaDayBounds(today);

  const [entriesResult, summaryResult] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*")
      .eq("profile_id", profileId)
      .is("deleted_at", null)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIsoExclusive)
      .order("occurred_at", { ascending: true }),
    supabase.from("time_daily_summary").select("*").eq("profile_id", profileId).eq("work_date", today).maybeSingle(),
  ]);

  const todayEntries: TimeEntry[] = entriesResult.data ?? [];
  const last = todayEntries[todayEntries.length - 1];
  const openEntry = last && last.kind === "entrada" ? last : null;

  return {
    openEntry,
    hasEntriesToday: todayEntries.length > 0,
    todayEntries,
    todaySummary: summaryResult.data ?? null,
    closedSecondsToday: sumClosedSecondsToday(todayEntries),
  };
}

/**
 * Soma, em segundos exatos, só os pares entrada→saída já fechados hoje — a sessão em aberto (se
 * houver) fica de fora. As entradas vêm alternadas e em ordem (a trigger do banco garante isso),
 * então parear por índice (0,1), (2,3)... é seguro; uma entrada final sem par (array de tamanho
 * ímpar) é ignorada pelo `i < length - 1`.
 */
function sumClosedSecondsToday(entries: TimeEntry[]): number {
  let total = 0;
  for (let i = 0; i < entries.length - 1; i += 2) {
    const entry = entries[i];
    const exit = entries[i + 1];
    if (entry?.kind === "entrada" && exit?.kind === "saida") {
      total += (new Date(exit.occurred_at).getTime() - new Date(entry.occurred_at).getTime()) / 1000;
    }
  }
  return total;
}

/** KPIs pessoais da página /banco-de-horas (visão "Minha"). */
export async function getBalanceKpis(profileId: string, yearMonth: string): Promise<BalanceKpis> {
  const supabase = await createClient();
  const { from, to } = monthRange(yearMonth);

  const [balanceResult, scheduleResult, monthDaysResult] = await Promise.all([
    supabase.from("time_balance_summary").select("*").eq("profile_id", profileId).maybeSingle(),
    supabase.from("work_schedules").select("*").eq("profile_id", profileId).maybeSingle(),
    supabase.from("time_daily_summary").select("worked_minutes").eq("profile_id", profileId).gte("work_date", from).lte("work_date", to),
  ]);

  const monthDays = monthDaysResult.data ?? [];
  const workedThisMonthMinutes = monthDays.reduce((sum, row) => sum + (row.worked_minutes ?? 0), 0);
  const daysWorkedThisMonth = monthDays.filter((row) => (row.worked_minutes ?? 0) > 0).length;

  return {
    totalBalanceMinutes: balanceResult.data?.total_balance_minutes ?? 0,
    monthBalanceMinutes: balanceResult.data?.month_balance_minutes ?? 0,
    weekBalanceMinutes: balanceResult.data?.week_balance_minutes ?? 0,
    totalWorkedMinutes: balanceResult.data?.total_worked_minutes ?? 0,
    dailyHours: scheduleResult.data?.daily_hours ?? 8,
    workedThisMonthMinutes,
    daysWorkedThisMonth,
  };
}

/** Série dos últimos 30 dias (saldo diário) para o gráfico "Evolução do saldo". */
export async function getBalanceChart(profileId: string): Promise<{ workDate: string; balanceMinutes: number }[]> {
  const supabase = await createClient();
  const today = todayDateOnly();
  const from = new Date(new Date(`${today}T12:00:00Z`).getTime() - 29 * 86400000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("time_daily_summary")
    .select("work_date, balance_minutes")
    .eq("profile_id", profileId)
    .gte("work_date", from)
    .lte("work_date", today)
    .order("work_date", { ascending: true });

  return (data ?? []).map((row) => ({ workDate: row.work_date ?? "", balanceMinutes: row.balance_minutes ?? 0 }));
}

/** Extrato do mês, um item por dia (mesmo os sem registro). */
export async function getExtractDays(profileId: string, yearMonth: string): Promise<ExtractDay[]> {
  const supabase = await createClient();
  const { from, to, year, month } = monthRange(yearMonth);
  const { startIso } = fortalezaDayBounds(from);
  const { endIsoExclusive } = fortalezaDayBounds(to);

  const [summaryResult, entriesResult] = await Promise.all([
    supabase.from("time_daily_summary").select("*").eq("profile_id", profileId).gte("work_date", from).lte("work_date", to),
    supabase
      .from("time_entries")
      .select("*")
      .eq("profile_id", profileId)
      .is("deleted_at", null)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIsoExclusive)
      .order("occurred_at", { ascending: true }),
  ]);

  const summaryByDay = new Map<string, TimeDailySummaryRow>();
  for (const row of summaryResult.data ?? []) {
    if (row.work_date) summaryByDay.set(row.work_date, row);
  }

  const entriesByDay = new Map<string, TimeEntry[]>();
  for (const entry of entriesResult.data ?? []) {
    const day = dateOnlyOf(entry.occurred_at);
    const list = entriesByDay.get(day) ?? [];
    list.push(entry);
    entriesByDay.set(day, list);
  }

  // Nunca mostra dias futuros do mês corrente (a view também não gera saldo pra eles); dias de
  // meses passados aparecem por inteiro, e um mês futuro (navegação manual) vem vazio.
  const today = todayDateOnly();
  const yesterday = shiftDateOnly(today, -1);
  const currentMonth = today.slice(0, 7);
  const lastDay = yearMonth > currentMonth ? 0 : yearMonth === currentMonth ? Number(today.slice(8, 10)) : daysInMonth(year, month);

  const days: ExtractDay[] = [];
  for (let day = lastDay; day >= 1; day--) {
    const workDate = `${yearMonth}-${pad(day)}`;
    const summary = summaryByDay.get(workDate);
    const entries = entriesByDay.get(workDate) ?? [];
    days.push({
      workDate,
      weekday: formatWeekday(workDate),
      relativeLabel: workDate === today ? "Hoje" : workDate === yesterday ? "Ontem" : null,
      entries,
      workedMinutes: summary?.worked_minutes ?? 0,
      balanceMinutes: summary?.balance_minutes ?? 0,
      expectedMinutes: summary?.expected_minutes ?? 0,
      hasRecord: entries.length > 0,
      openSession: summary?.open_session ?? false,
    });
  }
  return days;
}

function shiftDateOnly(dateOnly: string, deltaDays: number): string {
  return new Date(new Date(`${dateOnly}T12:00:00Z`).getTime() + deltaDays * 86400000).toISOString().slice(0, 10);
}

interface BasicProfile {
  id: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  squads: Squad[];
}

/** Perfis ativos com squads resolvidos — usado no filtro de pessoas da aba Equipe. */
export async function listActiveProfilesForTeam(): Promise<BasicProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, job_title, avatar_url, is_active, profile_squads(squad)")
    .eq("is_active", true)
    .neq("full_name", "")
    .order("full_name");

  return (data ?? []).map(({ profile_squads, ...profile }) => ({
    ...profile,
    squads: profile_squads.map((row) => row.squad),
  }));
}

/** Status de hoje + saldo do mês selecionado, para todo mundo (só diretoria/admin conseguem ler as linhas de outras pessoas). */
export async function getTeamStatus(yearMonth: string): Promise<TeamMemberStatus[]> {
  const supabase = await createClient();
  const today = todayDateOnly();
  const { from, to } = monthRange(yearMonth);

  const [profiles, todayResult, monthResult] = await Promise.all([
    listActiveProfilesForTeam(),
    supabase.from("time_daily_summary").select("*").eq("work_date", today),
    supabase.from("time_daily_summary").select("profile_id, balance_minutes").gte("work_date", from).lte("work_date", to),
  ]);

  const todayByProfile = new Map<string, TimeDailySummaryRow>();
  for (const row of todayResult.data ?? []) {
    if (row.profile_id) todayByProfile.set(row.profile_id, row);
  }

  const monthBalanceByProfile = new Map<string, number>();
  for (const row of monthResult.data ?? []) {
    if (!row.profile_id) continue;
    monthBalanceByProfile.set(row.profile_id, (monthBalanceByProfile.get(row.profile_id) ?? 0) + (row.balance_minutes ?? 0));
  }

  return profiles.map((profile) => {
    const todayRow = todayByProfile.get(profile.id);
    return {
      profileId: profile.id,
      fullName: profile.full_name,
      jobTitle: profile.job_title,
      avatarUrl: profile.avatar_url,
      squads: profile.squads,
      isWorking: todayRow?.open_session ?? false,
      hasRecordToday: Boolean(todayRow?.first_entry),
      todayWorkedMinutes: todayRow?.worked_minutes ?? 0,
      monthBalanceMinutes: monthBalanceByProfile.get(profile.id) ?? 0,
    };
  });
}

export async function getWorkSchedule(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("work_schedules").select("*").eq("profile_id", profileId).maybeSingle();
  return data;
}
