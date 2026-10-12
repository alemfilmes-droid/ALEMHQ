import "server-only";
import { buildObjectionReport, type ObjectionReportRow, type ReportPeriod } from "@/lib/prospeccao/objection-report";
import { todayInAppZone } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export interface ObjectionReport {
  rows: ObjectionReportRow[];
  playbookNames: Record<string, string>;
}

/** Objeções registradas, reuniões marcadas e nomes — calculado na leitura (a RLS limita ao que a pessoa vê). */
export async function loadObjectionReport(period: ReportPeriod): Promise<ObjectionReport> {
  const supabase = await createClient();
  const [objections, registered, meetings, playbooks] = await Promise.all([
    supabase.from("prospect_objections").select("id, shortcut, label"),
    supabase.from("prospect_lead_objections").select("deal_id, objection_id, playbook_id, created_at"),
    supabase.from("deal_meetings").select("deal_id, created_at"),
    supabase.from("prospect_playbooks").select("id, name"),
  ]);
  const failed = [objections, registered, meetings, playbooks].find((result) => result.error);
  if (failed?.error) throw new Error(`Falha ao carregar o relatório de objeções: ${failed.error.message}`);

  return {
    rows: buildObjectionReport(
      (registered.data ?? []).map((row) => ({ dealId: row.deal_id, objectionId: row.objection_id, playbookId: row.playbook_id, at: row.created_at })),
      (meetings.data ?? []).map((row) => ({ dealId: row.deal_id, at: row.created_at })),
      objections.data ?? [],
      period,
      todayInAppZone(),
    ),
    playbookNames: Object.fromEntries((playbooks.data ?? []).map((row) => [row.id, row.name])),
  };
}
