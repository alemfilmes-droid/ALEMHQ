import { z } from "zod";
import { isDateOnly } from "@/lib/calendar";
import { PROSPECTION_GOALS } from "@/features/crm/labels";
import { AUDIENCES, CADENCE_TYPES, HOLIDAY_SCOPES, OBJECTION_ACTIONS, TOUCH_ZERO_VARIANTS } from "@/features/prospeccao/labels";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Número digitado: campo vazio vira NaN no formulário. */
const number = () => z.number({ error: "Preencha com um número." });

function minutesOf(time: string): number {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export const meetingWindowSchema = z.object({
  start: z.string().regex(TIME, "Use o formato 09:00."),
  end: z.string().regex(TIME, "Use o formato 12:00."),
});

export type MeetingWindow = z.infer<typeof meetingWindowSchema>;

export const generalSettingsSchema = z.object({
  meetingDurationMinutes: number().int("Use minutos inteiros.").min(1, "A duração precisa ser maior que zero.").max(480, "Use no máximo 480 minutos."),
  meetingWindows: z
    .array(meetingWindowSchema)
    .min(1, "Cadastre pelo menos uma janela de horário.")
    .max(6, "Use no máximo 6 janelas.")
    .superRefine((windows, ctx) => {
      windows.forEach((window, index) => {
        if (minutesOf(window.end) <= minutesOf(window.start)) {
          ctx.addIssue({ code: "custom", path: [index, "end"], message: "O fim precisa ser depois do início." });
        }
      });
      const sorted = windows.map((window, index) => ({ ...window, index })).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1];
        const current = sorted[i];
        if (previous && current && minutesOf(current.start) < minutesOf(previous.end)) {
          ctx.addIssue({ code: "custom", path: [current.index, "start"], message: "Essa janela se sobrepõe a outra." });
        }
      }
    }),
  dailyTouchTarget: number().int("Use um número inteiro.").min(0, "Use zero ou mais.").max(1000, "Use no máximo 1000."),
  weeklyMeetingTarget: number().int("Use um número inteiro.").min(0, "Use zero ou mais.").max(1000, "Use no máximo 1000."),
  houseClientDelayDays: number().int("Use dias inteiros.").min(0, "Use zero ou mais.").max(365, "Use no máximo 365 dias."),
});

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => value.trim() || null)
    .nullable();

export const playbookSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2, "Dê um nome ao playbook.").max(80, "Use no máximo 80 caracteres."),
  audience: z.enum(AUDIENCES),
  cadenceType: z.enum(CADENCE_TYPES),
  touchZeroVariant: z.enum(TOUCH_ZERO_VARIANTS),
  /** Objetivo do negócio no CRM ao cadastrar um lead com este playbook. */
  crmGoal: z.enum(PROSPECTION_GOALS),
  /** Cliente da casa: o primeiro toque usa o script "cliente da casa". */
  usesHouseClientScript: z.boolean(),
  linkBase: z.string().trim().max(500, "Use no máximo 500 caracteres.").refine((value) => !/\s/.test(value), "O link não pode ter espaços."),
  linkAppendsSchoolParam: z.boolean(),
  caseText: optionalText(500),
  /** Cliente da casa: playbooks sugeridos a quem fechou este, em ordem. */
  houseSuggestionIds: z.array(z.string().uuid()).max(10),
});

export type PlaybookInput = z.input<typeof playbookSchema>;

export const scriptSchema = z
  .object({
    id: z.string().uuid().nullable(),
    playbookId: z.string().uuid().nullable(),
    kind: z.enum(["toque_zero", "toque", "sem_gancho", "reativacao", "cliente_da_casa", "oferta_reuniao"]),
    touchNumber: z.number().int().min(1).max(12).nullable(),
    touchZeroVariant: z.enum(TOUCH_ZERO_VARIANTS).nullable(),
    audience: z.enum(AUDIENCES).nullable(),
    body: z.string().max(4000, "Use no máximo 4000 caracteres."),
  })
  .refine((script) => script.kind === "reativacao" || script.body.trim().length > 0, { message: "O script não pode ficar vazio.", path: ["body"] });

export type ScriptInput = z.infer<typeof scriptSchema>;

export const cadenceSchema = z.object({
  cadenceType: z.enum(CADENCE_TYPES),
  touchOffsets: z
    .array(number().int("Use dias inteiros.").min(0).max(365, "Use no máximo 365 dias."))
    .min(1, "A cadência precisa de pelo menos um toque.")
    .max(12, "Use no máximo 12 toques.")
    .refine((offsets) => offsets[0] === 0, "O Toque 1 é sempre no dia 0.")
    .refine((offsets) => offsets.every((offset, index) => index === 0 || offset > (offsets[index - 1] ?? 0)), "Cada toque precisa vir depois do anterior."),
  reactivationDays: number().int("Use dias inteiros.").min(1, "Use pelo menos 1 dia.").max(365, "Use no máximo 365 dias."),
});

export type CadenceInput = z.infer<typeof cadenceSchema>;

export const objectionSchema = z.object({
  id: z.string().uuid().nullable(),
  shortcut: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^\/[a-z0-9]+(-[a-z0-9]+)*$/, "Use / seguido de letras, números e hífen (ex.: /ja-temos).")
    .max(40, "Use no máximo 40 caracteres."),
  label: z.string().trim().min(2, "Escreva a objeção.").max(120, "Use no máximo 120 caracteres."),
  responseBody: z.string().trim().min(2, "Escreva a resposta.").max(2000, "Use no máximo 2000 caracteres."),
  hqAction: z.enum(OBJECTION_ACTIONS),
});

export type ObjectionInput = z.infer<typeof objectionSchema>;

export const holidaySchema = z.object({
  date: z.string().refine(isDateOnly, "Escolha uma data."),
  name: z.string().trim().min(2, "Escreva o nome do feriado.").max(120, "Use no máximo 120 caracteres."),
  scope: z.enum(HOLIDAY_SCOPES),
  recurring: z.boolean(),
});

export type HolidayInput = z.infer<typeof holidaySchema>;

export const goalMappingSchema = z.object({
  playbookId: z.string().uuid(),
  goalId: z.string().uuid().nullable(),
});
