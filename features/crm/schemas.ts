import { z } from "zod";
import {
  DEAL_LOSS_REASONS,
  DEAL_STAGES,
  DIRECTION_TASKS,
  INTERACTION_CHANNELS,
  INTERACTION_KINDS,
  MEETING_OUTCOMES,
  PROPOSAL_CHANNELS,
  PROSPECTION_GOALS,
} from "@/features/crm/labels";
import { parseMoneyToCents } from "@/features/finance/money";
import { COMPANY_SOURCES, MODELS, TIERS } from "@/lib/domain";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const optionalIsoDate = isoDate.or(z.literal(""));
const optionalUuid = z.string().uuid().or(z.literal(""));
const time = z.string().regex(/^\d{2}:\d{2}$/, "Informe um horário válido.");
const optionalMoney = z
  .string()
  .trim()
  .refine((value) => value === "" || parseMoneyToCents(value) !== null, "Informe um valor válido.");
const requiredMoney = z
  .string()
  .trim()
  .min(1, "Informe o valor.")
  .refine((value) => {
    const cents = parseMoneyToCents(value);
    return cents !== null && cents > 0;
  }, "Informe um valor maior que zero.");

/** "2026-03-05" + "09:00" (data e hora do input) → timestamptz estável em America/Fortaleza (UTC-3, sem DST). */
export function dateOnlyToFortalezaTimestamp(date: string, timeOfDay = "09:00") {
  return new Date(`${date}T${timeOfDay}:00-03:00`).toISOString();
}

const channel = z.enum(INTERACTION_CHANNELS, { message: "Selecione o canal." });

/** Próxima ação: obrigatória em qualquer negócio aberto. */
const nextActionFields = {
  nextAction: z.string().trim().min(2, "Informe a próxima ação.").max(200, "Use até 200 caracteres."),
  nextActionDate: isoDate,
  nextActionTime: time,
};

/** O que foi feito no contato: canal, abordagem e conteúdo. */
const interactionFields = {
  channel,
  approach: z.string().trim().min(2, "Informe a abordagem usada.").max(200, "Use até 200 caracteres."),
  body: z.string().trim().min(2, "Descreva o que foi dito ou feito.").max(1500, "Use até 1500 caracteres."),
};

export const dealSchema = z
  .object({
    companyMode: z.enum(["existente", "nova"]),
    companyId: optionalUuid,
    companyName: z.string().trim().max(120, "Use até 120 caracteres."),
    document: z.string().trim().max(24, "Use até 24 caracteres."),
    segment: z.string().trim().max(80, "Use até 80 caracteres."),
    city: z.string().trim().max(80, "Use até 80 caracteres."),
    instagram: z.string().trim().max(60, "Use até 60 caracteres."),
    website: z.string().trim().max(200, "Use até 200 caracteres."),
    primaryContactId: optionalUuid,
    contactName: z.string().trim().max(120, "Use até 120 caracteres."),
    contactJobTitle: z.string().trim().max(80, "Use até 80 caracteres."),
    contactPhone: z
      .string()
      .trim()
      .max(20, "Use até 20 caracteres.")
      .regex(/^[+()\d\s-]*$/, "Use apenas números, espaços, +, ( ) e -."),
    contactEmail: z.string().trim().email("Informe um e-mail válido.").or(z.literal("")),
    title: z.string().trim().min(2, "Informe o título do negócio.").max(140, "Use até 140 caracteres."),
    ownerId: z.string().uuid("Selecione o responsável."),
    goals: z.array(z.enum(PROSPECTION_GOALS)).min(1, "Selecione ao menos um objetivo."),
    estimatedValue: optionalMoney,
    expectedCloseDate: optionalIsoDate,
    source: z.enum(COMPANY_SOURCES).or(z.literal("")),
    ...nextActionFields,
  })
  .superRefine((data, ctx) => {
    if (data.companyMode === "existente" && data.companyId === "") {
      ctx.addIssue({ code: "custom", path: ["companyId"], message: "Selecione a empresa." });
    }
    if (data.companyMode === "nova") {
      if (data.companyName.length < 2) ctx.addIssue({ code: "custom", path: ["companyName"], message: "Informe o nome da empresa." });
      if (data.contactName.length < 2) ctx.addIssue({ code: "custom", path: ["contactName"], message: "Informe o nome do contato." });
    }
  });

export type DealValues = z.infer<typeof dealSchema>;

export const updateDealSchema = z.object({
  primaryContactId: optionalUuid.optional(),
  ownerId: z.string().uuid().optional(),
  goals: z.array(z.enum(PROSPECTION_GOALS)).min(1, "Selecione ao menos um objetivo.").optional(),
  estimatedValue: optionalMoney.optional(),
  expectedCloseDate: optionalIsoDate.optional(),
  source: z.enum(COMPANY_SOURCES).or(z.literal("")).optional(),
  nextAction: z.string().trim().min(2, "Informe a próxima ação.").max(200, "Use até 200 caracteres.").optional(),
  nextActionDate: isoDate.optional(),
  nextActionTime: time.optional(),
});

export type UpdateDealValues = z.infer<typeof updateDealSchema>;

export const qualificationSchema = z.object({
  budgetRange: z.string().trim().max(120, "Use até 120 caracteres."),
  projectType: z.string().trim().max(120, "Use até 120 caracteres."),
  desiredTimeline: z.string().trim().max(120, "Use até 120 caracteres."),
  decisionMakerContacted: z.boolean(),
  painPoint: z.string().trim().max(500, "Use até 500 caracteres."),
  notes: z.string().trim().max(500, "Use até 500 caracteres."),
});

export type QualificationValues = z.infer<typeof qualificationSchema>;

/** Mudança de etapa comum: exige o registro do contato e a próxima ação. */
export const stageChangeSchema = z.object({
  dealId: z.string().uuid(),
  stage: z.enum(DEAL_STAGES),
  kind: z.enum(INTERACTION_KINDS),
  ...interactionFields,
  ...nextActionFields,
});

export type StageChangeValues = z.infer<typeof stageChangeSchema>;

/** "+ Registrar contato": mais uma tentativa, sem mudar de etapa. */
export const contactSchema = z.object({
  dealId: z.string().uuid(),
  ...interactionFields,
  nextAction: z.string().trim().max(200, "Use até 200 caracteres."),
  nextActionDate: optionalIsoDate,
  nextActionTime: time,
});

export type ContactValues = z.infer<typeof contactSchema>;

/** "Cliente respondeu": registra a resposta e a tentativa que ela responde. */
export const clientResponseSchema = z.object({
  dealId: z.string().uuid(),
  channel,
  approach: z.string().trim().max(200, "Use até 200 caracteres."),
  body: z.string().trim().min(2, "Registre o que o cliente respondeu.").max(1500, "Use até 1500 caracteres."),
  respondedToId: optionalUuid,
  ...nextActionFields,
});

export type ClientResponseValues = z.infer<typeof clientResponseSchema>;

export const lossSchema = z.object({
  dealId: z.string().uuid(),
  reason: z.enum(DEAL_LOSS_REASONS, { message: "Selecione o motivo da perda." }),
  note: z.string().trim().max(500, "Use até 500 caracteres."),
});

export type LossValues = z.infer<typeof lossSchema>;

export const meetingSchema = z.object({
  dealId: z.string().uuid(),
  scheduledDate: isoDate,
  scheduledTime: time,
  durationMinutes: z
    .string()
    .trim()
    .regex(/^\d+$/, "Informe a duração em minutos.")
    .refine((value) => Number(value) >= 15 && Number(value) <= 480, "Use de 15 a 480 minutos."),
  attendeeId: z.string().uuid("Selecione quem vai atender."),
  locationOrLink: z.string().trim().max(300, "Use até 300 caracteres."),
});

export type MeetingValues = z.infer<typeof meetingSchema>;

export const outcomeSchema = z
  .object({
    meetingId: z.string().uuid(),
    result: z.enum(MEETING_OUTCOMES, { message: "Selecione o resultado." }),
    note: z.string().trim().min(3, "Registre o que aconteceu na reunião.").max(1500, "Use até 1500 caracteres."),
    nextAction: z.string().trim().max(200, "Use até 200 caracteres."),
    nextActionDate: optionalIsoDate,
    nextActionTime: time,
    newDate: optionalIsoDate,
    newTime: time,
    newDuration: z.string().trim().regex(/^\d*$/, "Informe minutos."),
    newLocation: z.string().trim().max(300, "Use até 300 caracteres."),
  })
  .superRefine((data, ctx) => {
    if (data.result === "remarcar" && data.newDate === "") {
      ctx.addIssue({ code: "custom", path: ["newDate"], message: "Informe a nova data da reunião." });
    }
  });

export type OutcomeValues = z.infer<typeof outcomeSchema>;

export const directionSchema = z.object({
  dealId: z.string().uuid(),
  task: z.enum(DIRECTION_TASKS, { message: "Selecione a próxima ação para o SDR." }),
  note: z.string().trim().max(1000, "Use até 1000 caracteres."),
  dueDate: isoDate,
  dueTime: time,
});

export type DirectionValues = z.infer<typeof directionSchema>;

export const proposalSchema = z.object({
  dealId: z.string().uuid(),
  amount: requiredMoney,
  channel: z.enum(PROPOSAL_CHANNELS, { message: "Selecione como foi enviada." }),
  documentUrl: z.string().trim().max(500, "Use até 500 caracteres.").refine((value) => value === "" || /^https?:\/\//i.test(value), "Informe um link começando com http."),
  scopeNotes: z.string().trim().max(1000, "Use até 1000 caracteres."),
  ...nextActionFields,
});

export type ProposalValues = z.infer<typeof proposalSchema>;

export const negotiationSchema = z.object({
  dealId: z.string().uuid(),
  proposalId: z.string().uuid("Registre uma proposta antes de negociar."),
  clientCounterAmount: optionalMoney,
  ourCounterAmount: optionalMoney,
  agreedAmount: optionalMoney,
  channel,
  notes: z.string().trim().min(2, "Registre o que foi conversado.").max(1500, "Use até 1500 caracteres."),
  ...nextActionFields,
});

export type NegotiationValues = z.infer<typeof negotiationSchema>;

export const wonSchema = z
  .object({
    dealId: z.string().uuid(),
    projectName: z.string().trim().min(2, "Informe o nome do projeto.").max(140, "Use até 140 caracteres."),
    projectModel: z.enum(MODELS),
    contractValue: optionalMoney,
    tier: z.enum(TIERS, { message: "Selecione o nível do cliente." }),
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
    projectOwnerId: z.string().uuid("Selecione o responsável pelo projeto."),
    atendimentoId: z.string().uuid("Selecione o atendimento responsável."),
  })
  .superRefine((data, ctx) => {
    if (data.projectModel === "transacional" && data.endDate === "") {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Informe a data de entrega." });
    }
    if (data.projectModel === "recorrente" && data.startDate === "") {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Informe o início do projeto." });
    }
  });

export type WonValues = z.infer<typeof wonSchema>;

export const reheatSchema = z
  .object({
    dealId: z.string().uuid(),
    path: z.enum(["nova_prospeccao", "venda_direta"], { message: "Escolha o caminho do reaquecimento." }),
    body: z.string().trim().min(2, "Registre como o lead foi reabordado.").max(1500, "Use até 1500 caracteres."),
    ...nextActionFields,
    amount: optionalMoney,
    proposalChannel: z.enum(PROPOSAL_CHANNELS).or(z.literal("")),
    documentUrl: z.string().trim().max(500, "Use até 500 caracteres."),
    scopeNotes: z.string().trim().max(1000, "Use até 1000 caracteres."),
  })
  .superRefine((data, ctx) => {
    if (data.path === "venda_direta") {
      const cents = parseMoneyToCents(data.amount);
      if (cents === null || cents <= 0) ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe o valor da proposta." });
      if (data.proposalChannel === "") ctx.addIssue({ code: "custom", path: ["proposalChannel"], message: "Selecione como foi enviada." });
    }
  });

export type ReheatValues = z.infer<typeof reheatSchema>;

export const reassignOwnerSchema = z.object({
  dealIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um negócio."),
  ownerId: z.string().uuid("Selecione o novo responsável."),
});

export type ReassignOwnerValues = z.infer<typeof reassignOwnerSchema>;

export const commissionRuleSchema = z.object({
  kind: z.enum(["padrao", "reaquecido"]),
  percent: z
    .string()
    .trim()
    .refine((value) => {
      const number = Number(value.replace(",", "."));
      return Number.isFinite(number) && number >= 0 && number <= 100;
    }, "Use um percentual de 0 a 100."),
});

export type CommissionRuleValues = z.infer<typeof commissionRuleSchema>;

export const stageProbabilitySchema = z.object({
  stage: z.enum(DEAL_STAGES),
  probability: z
    .string()
    .trim()
    .refine((value) => {
      const number = Number(value.replace(",", "."));
      return Number.isFinite(number) && number >= 0 && number <= 100;
    }, "Use um percentual de 0 a 100."),
});

export type StageProbabilityValues = z.infer<typeof stageProbabilitySchema>;
