import { addDays, todayInAppZone } from "@/lib/calendar";

/**
 * Relatório de objeções (spec 5): quais aparecem mais, em quais playbooks e quantos leads com
 * cada objeção chegaram a reunião marcada depois dela. Puro; períodos no dia de Fortaleza.
 */

export type ReportPeriod = "30d" | "trimestre" | "tudo";

export interface RegisteredObjection {
  dealId: string;
  objectionId: string;
  playbookId: string | null;
  at: string;
}

export interface BookedMeeting {
  dealId: string;
  at: string;
}

export interface ObjectionMeta {
  id: string;
  shortcut: string;
  label: string;
}

export interface ObjectionReportRow extends ObjectionMeta {
  /** Vezes que foi registrada. */
  total: number;
  /** Leads diferentes com essa objeção. */
  leads: number;
  /** Desses leads, quantos tiveram reunião marcada depois da objeção. */
  leadsWithMeeting: number;
  /** leadsWithMeeting / leads (nulo sem leads). */
  conversion: number | null;
  byPlaybook: { playbookId: string | null; total: number }[];
}

/** Primeiro dia do período (yyyy-mm-dd); nulo = tudo. Trimestre = o trimestre do calendário atual. */
export function periodStart(period: ReportPeriod, today: string): string | null {
  if (period === "tudo") return null;
  if (period === "30d") return addDays(today, -29);
  const month = Number(today.slice(5, 7));
  const quarterMonth = String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0");
  return `${today.slice(0, 4)}-${quarterMonth}-01`;
}

export function buildObjectionReport(
  registered: readonly RegisteredObjection[],
  meetings: readonly BookedMeeting[],
  objections: readonly ObjectionMeta[],
  period: ReportPeriod,
  today: string,
): ObjectionReportRow[] {
  const start = periodStart(period, today);
  const inPeriod = registered.filter((item) => !start || todayInAppZone(new Date(item.at)) >= start);
  const meetingsByDeal = new Map<string, number[]>();
  for (const meeting of meetings) {
    const list = meetingsByDeal.get(meeting.dealId) ?? [];
    list.push(Date.parse(meeting.at));
    meetingsByDeal.set(meeting.dealId, list);
  }

  return objections
    .map((objection) => {
      const rows = inPeriod.filter((item) => item.objectionId === objection.id);
      // Primeira vez que cada lead levantou a objeção: a reunião precisa vir depois dela.
      const firstByDeal = new Map<string, number>();
      for (const row of rows) {
        const at = Date.parse(row.at);
        firstByDeal.set(row.dealId, Math.min(at, firstByDeal.get(row.dealId) ?? at));
      }
      const leadsWithMeeting = [...firstByDeal].filter(([dealId, at]) => (meetingsByDeal.get(dealId) ?? []).some((meetingAt) => meetingAt >= at)).length;
      const byPlaybook = new Map<string | null, number>();
      for (const row of rows) byPlaybook.set(row.playbookId, (byPlaybook.get(row.playbookId) ?? 0) + 1);
      return {
        ...objection,
        total: rows.length,
        leads: firstByDeal.size,
        leadsWithMeeting,
        conversion: firstByDeal.size ? leadsWithMeeting / firstByDeal.size : null,
        byPlaybook: [...byPlaybook].map(([playbookId, total]) => ({ playbookId, total })).sort((a, b) => b.total - a.total),
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}
