import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface InvoiceScheduleView {
  id: string;
  frequency: "mensal" | "unica";
  dayOfMonth: number | null;
  issueDate: string | null;
  responsibleId: string;
  responsibleName: string;
  contactName: string | null;
  contactEmail: string | null;
  sendToEmail: string | null;
  notes: string | null;
  /** Período vigente (1º do mês, ou a data única) e se a nota dele já foi emitida. */
  period: string;
  issued: { at: string; number: string | null; filePath: string | null } | null;
}

function todayInFortaleza() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
}

export async function getInvoiceSchedules(projectId: string): Promise<InvoiceScheduleView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_invoice_schedules")
    .select(
      "id, frequency, day_of_month, issue_date, responsible_id, send_to_email, notes, responsible:profiles!project_invoice_schedules_responsible_id_fkey(full_name), contact:contacts(full_name, email), issuances:invoice_issuances(period, issued_at, invoice_number, file_path)",
    )
    .eq("project_id", projectId)
    .eq("active", true)
    .order("created_at");
  const monthStart = `${todayInFortaleza().slice(0, 8)}01`;
  return (data ?? []).map((row) => {
    const period = row.frequency === "mensal" ? monthStart : (row.issue_date ?? monthStart);
    const issuance = row.issuances.find((item) => item.period === period);
    return {
      id: row.id,
      frequency: row.frequency,
      dayOfMonth: row.day_of_month,
      issueDate: row.issue_date,
      responsibleId: row.responsible_id,
      responsibleName: row.responsible?.full_name ?? "—",
      contactName: row.contact?.full_name ?? null,
      contactEmail: row.contact?.email ?? null,
      sendToEmail: row.send_to_email,
      notes: row.notes,
      period,
      issued: issuance ? { at: issuance.issued_at, number: issuance.invoice_number, filePath: issuance.file_path } : null,
    };
  });
}
