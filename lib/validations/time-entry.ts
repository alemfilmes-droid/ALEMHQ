import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const timeHHmm = /^\d{2}:\d{2}$/;

export const manualEntrySchema = z.object({
  kind: z.enum(["entrada", "saida"], { message: "Selecione o tipo." }),
  date: z.string().regex(isoDate, "Informe uma data válida."),
  time: z.string().regex(timeHHmm, "Informe um horário válido."),
  note: z.string().trim().max(500, "Use até 500 caracteres."),
});

export type ManualEntryValues = z.infer<typeof manualEntrySchema>;

export const editEntrySchema = manualEntrySchema;

export type EditEntryValues = z.infer<typeof editEntrySchema>;

/** Validação do servidor (Server Action): aceita number diretamente e effectiveFrom já normalizado (string ou null). */
export const workScheduleSchema = z.object({
  dailyHours: z.coerce.number({ message: "Informe a carga diária." }).min(0.5, "Mínimo de 0,5h.").max(24, "Máximo de 24h."),
  workdays: z.array(z.number().int().min(1).max(7)).min(1, "Selecione ao menos um dia."),
  /** Nulo = usa a data de criação do perfil (comportamento padrão). */
  effectiveFrom: z.string().regex(isoDate, "Informe uma data válida.").nullable(),
});

export type WorkScheduleValues = z.infer<typeof workScheduleSchema>;

/**
 * Validação do formulário: `dailyHours` e `effectiveFrom` ficam como texto (o input HTML já
 * entrega string) — evita o conflito de tipos do z.coerce.number() com o generic do
 * react-hook-form. A conversão acontece só ao montar o payload enviado para a Server Action.
 */
export const workScheduleFormSchema = z.object({
  dailyHours: z
    .string()
    .trim()
    .regex(/^\d{1,2}([.,]\d{1,2})?$/, "Use um número como 8 ou 6,5.")
    .refine((value) => Number(value.replace(",", ".")) >= 0.5 && Number(value.replace(",", ".")) <= 24, "Use entre 0,5 e 24 horas."),
  workdays: z.array(z.number().int().min(1).max(7)).min(1, "Selecione ao menos um dia."),
  effectiveFrom: z.string().regex(isoDate, "Informe uma data válida.").or(z.literal("")),
});

export type WorkScheduleFormValues = z.infer<typeof workScheduleFormSchema>;
