import { z } from "zod";
import { RECURRENCES } from "@/features/agenda/recurrence";

export const COMMITMENT_KINDS = ["reuniao_comercial", "captacao", "entrega", "interno"] as const;
export const COMMITMENT_VISIBILITIES = ["equipe", "privado"] as const;
/** Minutos antes do início; "" = sem lembrete. */
export const REMINDER_OPTIONS = ["", "10", "30", "60", "1440"] as const;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const time = /^\d{2}:\d{2}$/;
const uuidOrEmpty = z.string().uuid().or(z.literal(""));

export const commitmentSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título.").max(160, "Use até 160 caracteres."),
    kind: z.enum(COMMITMENT_KINDS),
    date: z.string().regex(isoDate, "Informe a data."),
    allDay: z.boolean(),
    startTime: z.string().regex(time, "Informe o início.").or(z.literal("")),
    endTime: z.string().regex(time, "Informe o fim.").or(z.literal("")),
    attendees: z.array(z.string().uuid()).max(50),
    externalAttendees: z
      .array(
        z.object({
          name: z.string().trim().max(120, "Use até 120 caracteres."),
          email: z.string().trim().max(200).email("E-mail inválido.").or(z.literal("")),
        }),
      )
      .max(30),
    location: z.string().trim().max(500, "Use até 500 caracteres."),
    notes: z.string().trim().max(2000, "Use até 2000 caracteres."),
    companyId: uuidOrEmpty,
    projectId: uuidOrEmpty,
    dealId: uuidOrEmpty,
    pautaId: uuidOrEmpty,
    reminder: z.enum(REMINDER_OPTIONS),
    visibility: z.enum(COMMITMENT_VISIBILITIES),
    recurrence: z.enum(RECURRENCES),
    recurrenceUntil: z.string().regex(isoDate, "Data inválida.").or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (!data.allDay) {
      if (!data.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Informe o início." });
      if (!data.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Informe o fim." });
      if (data.startTime && data.endTime && data.endTime <= data.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "O fim deve ser depois do início." });
      }
    }
    if (data.recurrence !== "none" && data.recurrenceUntil && data.recurrenceUntil < data.date) {
      ctx.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "Termina antes de começar." });
    }
    data.externalAttendees.forEach((attendee, index) => {
      if (!attendee.name && !attendee.email) {
        ctx.addIssue({ code: "custom", path: ["externalAttendees", index, "name"], message: "Informe nome ou e-mail." });
      }
    });
  });

export type CommitmentValues = z.infer<typeof commitmentSchema>;
