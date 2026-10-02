"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const scheduleSchema = z
  .object({
    projectId: z.string().uuid(),
    frequency: z.enum(["mensal", "unica"]),
    dayOfMonth: z.string().regex(/^\d{1,2}$/).or(z.literal("")),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    responsibleId: z.string().uuid("Escolha quem emite."),
    contactId: z.string().uuid().or(z.literal("")),
    sendToEmail: z.string().trim().email("E-mail inválido.").or(z.literal("")),
    notes: z.string().trim().max(1000),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === "mensal") {
      const day = Number(value.dayOfMonth);
      if (!value.dayOfMonth || day < 1 || day > 31) ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Dia de 1 a 31." });
    } else if (!value.issueDate) {
      ctx.addIssue({ code: "custom", path: ["issueDate"], message: "Informe a data." });
    }
  });

export type InvoiceScheduleValues = z.infer<typeof scheduleSchema>;

function refresh(projectId: string) {
  revalidatePath(`/projetos/${projectId}`);
}

export async function createInvoiceScheduleAction(values: InvoiceScheduleValues): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("project_invoice_schedules").insert({
    project_id: d.projectId,
    frequency: d.frequency,
    day_of_month: d.frequency === "mensal" ? Number(d.dayOfMonth) : null,
    issue_date: d.frequency === "unica" ? d.issueDate : null,
    responsible_id: d.responsibleId,
    contact_id: d.contactId || null,
    send_to_email: d.sendToEmail || null,
    notes: d.notes || null,
  });
  if (error) return { ok: false, error: error.code === "42501" ? "Só o financeiro, a diretoria ou o responsável pelo projeto agendam notas." : "Não foi possível salvar." };
  refresh(d.projectId);
  return { ok: true, message: "Emissão de nota fiscal agendada. O responsável é lembrado no dia." };
}

export async function deleteInvoiceScheduleAction(id: string, projectId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_invoice_schedules").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível remover." };
  refresh(projectId);
  return { ok: true, message: "Agendamento removido." };
}

/** Marca a nota do período como emitida — para os lembretes. */
export async function markInvoiceIssuedAction(input: { scheduleId: string; projectId: string; period: string; invoiceNumber: string }): Promise<ActionResult> {
  const schema = z.object({
    scheduleId: z.string().uuid(),
    projectId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    invoiceNumber: z.string().trim().max(60),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_issuances").insert({
    schedule_id: parsed.data.scheduleId,
    period: parsed.data.period,
    invoice_number: parsed.data.invoiceNumber || null,
    issued_by: profile.id,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "Esta nota já foi marcada como emitida." : "Não foi possível marcar." };
  refresh(parsed.data.projectId);
  return { ok: true, message: "Nota marcada como emitida." };
}
