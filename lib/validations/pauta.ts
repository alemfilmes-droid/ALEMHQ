import { z } from "zod";
import { PAUTA_CAPTURE_TYPES, PAUTA_STATUSES } from "@/lib/pautas";
import { PAUTA_COLUMNS } from "@/lib/pautas";
import { PRIORITIES } from "@/lib/domain";
import { PAUTA_ACTIVITIES } from "@/lib/auth/roles";
import type { ProductionFunction } from "@/types";
import { SQUADS } from "@/lib/auth/squads";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.string().regex(isoDate, "Informe uma data válida.").or(z.literal(""));
const optionalUrl = z
  .string()
  .trim()
  .max(500, "Use até 500 caracteres.")
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use um link começando com http:// ou https://")
  .or(z.literal(""));

/** Atividade da pauta (produção, comercial, financeiro, diretoria) — ver PAUTA_ACTIVITIES_BY_SQUAD. */
const activitySchema = z.custom<ProductionFunction>(
  (value) => typeof value === "string" && (PAUTA_ACTIVITIES as readonly string[]).includes(value),
  { message: "Selecione a atividade." },
);

const optionalTime = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Informe um horário válido.")
  .or(z.literal(""));

/** Responsável adicional da pauta, com a atividade dele. */
export const pautaMemberInputSchema = z.object({
  profileId: z.string().uuid("Escolha a pessoa."),
  productionFunction: activitySchema,
});

/**
 * Pauta/tarefa para o time. Cliente e projeto são opcionais (ex.: ajuste no CRM de um prospect, que
 * ainda não tem projeto; ou tarefa interna da equipe). Líder revisa; o responsável executa.
 */
export const createPautaSchema = z.object({
  /** Vazio = sem projeto. */
  projectId: z.string().uuid().or(z.literal("")),
  /** Cliente quando não há projeto; vazio = sem cliente (tarefa interna da equipe). */
  companyId: z.string().uuid().or(z.literal("")),
  /** Quem executa (responsável atual). Vazio = o próprio líder. */
  executorId: z.string().uuid().or(z.literal("")),
  executorActivity: activitySchema,
  dueTime: optionalTime,
  /** Squad da pauta; vazio = o padrão do banco (audiovisual). */
  squad: z.enum(SQUADS).or(z.literal("")),
  members: z.array(pautaMemberInputSchema).max(20, "Use até 20 responsáveis."),
  /** Freelancer com quem está a execução (opcional) — não é responsável; a equipe cobra. */
  freelancerId: z.string().uuid().or(z.literal("")),
  title: z.string().trim().min(2, "Informe o título.").max(160, "Use até 160 caracteres."),
  briefing: z.string().trim().max(4000, "Use até 4000 caracteres."),
  leadId: z.string().uuid("Selecione o líder."),
  boardColumn: z.enum(PAUTA_COLUMNS).or(z.literal("")),
  priority: z.enum(PRIORITIES),
  isCritical: z.boolean(),
  captureType: z.array(z.enum(PAUTA_CAPTURE_TYPES)).max(PAUTA_CAPTURE_TYPES.length),
  format: z.string().trim().max(60, "Use até 60 caracteres."),
  locationAddress: z.string().trim().max(300, "Use até 300 caracteres."),
  scheduledDate: optionalDate,
  scheduledTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Informe um horário válido.")
    .or(z.literal("")),
  durationMinutes: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Informe um número de minutos.")
    .or(z.literal("")),
  startDate: optionalDate,
  dueDate: optionalDate,
  contactId: z.string().uuid().or(z.literal("")),
  contactPhoneOverride: z.string().trim().max(30, "Use até 30 caracteres."),
  driveFolderUrl: optionalUrl,
  scriptUrl: optionalUrl,
  equipmentNotes: z.string().trim().max(1000, "Use até 1000 caracteres."),
});

export type CreatePautaValues = z.infer<typeof createPautaSchema>;

/** Edição de campos do briefing da pauta — tudo opcional, valida só o que vier preenchido. */
export const updatePautaSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(160, "Use até 160 caracteres.").optional(),
  briefing: z.string().trim().max(4000, "Use até 4000 caracteres.").nullable().optional(),
  status: z.enum(PAUTA_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  isCritical: z.boolean().optional(),
  leadId: z.string().uuid().optional(),
  captureType: z.array(z.enum(PAUTA_CAPTURE_TYPES)).max(PAUTA_CAPTURE_TYPES.length).optional(),
  format: z.string().trim().max(60).nullable().optional(),
  locationAddress: z.string().trim().max(300).nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  waitingOnContactId: z.string().uuid().nullable().optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  contactPhoneOverride: z.string().trim().max(30).nullable().optional(),
  driveFolderUrl: z.string().trim().max(500).nullable().optional(),
  deliveryUrl: z.string().trim().max(500).nullable().optional(),
  scriptUrl: z.string().trim().max(500).nullable().optional(),
  equipmentNotes: z.string().trim().max(1000).nullable().optional(),
  freelancerId: z.string().uuid().nullable().optional(),
});

export type UpdatePautaValues = z.infer<typeof updatePautaSchema>;

/**
 * "Passar adiante": para qualquer etapa, diz para quem vai e o que a pessoa vai fazer — menos para
 * aprovar, quando a pauta termina e não vai para ninguém. A nota vira um registro da pauta.
 */
export const handoverSchema = z
  .object({
    pautaId: z.string().uuid(),
    status: z.enum(PAUTA_STATUSES),
    assigneeId: z.string().uuid().or(z.literal("")),
    functionRole: activitySchema.or(z.literal("")),
    dueDate: optionalDate,
    dueTime: optionalTime,
    note: z.string().trim().max(2000, "Use até 2000 caracteres."),
  })
  .superRefine((value, ctx) => {
    if (value.status === "aprovado") return;
    if (!value.assigneeId) ctx.addIssue({ code: "custom", path: ["assigneeId"], message: "Escolha para quem vai." });
    if (!value.functionRole) ctx.addIssue({ code: "custom", path: ["functionRole"], message: "Diga o que a pessoa vai fazer." });
    if (value.status === "reajuste" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Diga o que precisa ajustar." });
    }
  });

export type HandoverValues = z.infer<typeof handoverSchema>;

export const moveColumnSchema = z.object({
  id: z.string().uuid(),
  column: z.enum(PAUTA_COLUMNS),
});

/** Registro de execução ("o que eu fiz"), com link opcional (documento, print, planilha). */
export const pautaLogSchema = z.object({
  pautaId: z.string().uuid(),
  body: z.string().trim().min(3, "Conte o que foi feito.").max(4000, "Use até 4000 caracteres."),
  linkUrl: optionalUrl,
});

export type PautaLogValues = z.infer<typeof pautaLogSchema>;

export const commentSchema = z.object({
  pautaId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva um comentário.").max(2000, "Use até 2000 caracteres."),
});

/** Tarefa avulsa (quadro pessoal): sem cliente nem projeto — só título, descrição, prazo e prioridade. */
export const createStandaloneTaskSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(160, "Use até 160 caracteres."),
  description: z.string().trim().max(2000, "Use até 2000 caracteres."),
  dueDate: optionalDate,
  priority: z.enum(PRIORITIES),
  /** Squad de origem — só quem está em mais de um squad escolhe; vazio = o banco decide. */
  squad: z.enum(SQUADS).or(z.literal("")),
});

export type CreateStandaloneTaskValues = z.infer<typeof createStandaloneTaskSchema>;
