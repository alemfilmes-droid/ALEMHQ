import { z } from "zod";

const percent = z
  .string()
  .trim()
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number({ message: "Informe um número." }).min(0, "Use de 0 a 100.").max(100, "Use de 0 a 100."));

export const companySettingsSchema = z
  .object({
    defaultDailyHours: z
      .string()
      .trim()
      .transform((value) => Number(value.replace(",", ".")))
      .pipe(z.number({ message: "Informe as horas." }).gt(0, "Use mais que 0 h.").max(24, "Use até 24 h.")),
    defaultWorkdays: z.array(z.number().int().min(1).max(7)).min(1, "Escolha ao menos um dia."),
    healthyMarginPct: percent,
    attentionMarginPct: percent,
  })
  .refine((values) => values.attentionMarginPct <= values.healthyMarginPct, {
    message: "O limite de atenção não pode passar da margem saudável.",
    path: ["attentionMarginPct"],
  });

export type CompanySettingsInput = z.input<typeof companySettingsSchema>;
