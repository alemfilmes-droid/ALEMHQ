import { z } from "zod";
import { MODELS, PRIORITIES, PROJECT_STAGES, SERVICE_TYPES } from "@/lib/domain";
import { PAYABLE_CATEGORIES } from "@/features/finance/labels";

const moneyPattern = /^\d{1,12}([.,]\d{1,2})?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const money = z.string().trim().regex(moneyPattern, "Informe um valor válido.").or(z.literal(""));
const optionalDate = z.string().regex(isoDate, "Informe uma data válida.").or(z.literal(""));

const costSchema = z.object({
  description: z.string().trim().min(2, "Informe a descrição.").max(160, "Use até 160 caracteres."),
  category: z.enum(PAYABLE_CATEGORIES, { message: "Selecione a categoria." }),
  amount: z
    .string()
    .trim()
    .min(1, "Informe o valor.")
    .regex(moneyPattern, "Informe um valor válido."),
  dueDate: optionalDate,
});

export const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do projeto.").max(140, "Use até 140 caracteres."),
    isInternal: z.boolean(),
    companyId: z.string().uuid().or(z.literal("")),
    contactId: z.string().uuid().or(z.literal("")),
    briefing: z.string().trim().max(2000, "Use até 2000 caracteres."),
    serviceTypes: z.array(z.enum(SERVICE_TYPES)).max(SERVICE_TYPES.length),
    priority: z.enum(PRIORITIES),
    stage: z.enum(PROJECT_STAGES),
    model: z.enum(MODELS),
    dueDate: optionalDate,
    startDate: optionalDate,
    endDate: optionalDate,
    ownerId: z.string().uuid("Selecione o responsável."),
    memberIds: z.array(z.string().uuid()),
    driveFolderUrl: z
      .string()
      .trim()
      .max(500, "Use até 500 caracteres.")
      .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use um link começando com http:// ou https://")
      .or(z.literal("")),
    includedRevisionRounds: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/, "Informe um número de 0 a 99.")
      .or(z.literal("")),
    // Campos financeiros: o servidor só os aceita de quem tem acesso ao financeiro.
    contractValue: money,
    paymentTerms: z.string().trim().max(500, "Use até 500 caracteres."),
    costs: z.array(costSchema).max(30, "Use até 30 custos."),
  })
  .superRefine((data, ctx) => {
    if (!data.isInternal && !data.companyId) {
      ctx.addIssue({ code: "custom", path: ["companyId"], message: "Selecione o cliente." });
    }
    if (data.model === "transacional" && !data.dueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Informe a data de entrega." });
    }
    if (data.model === "recorrente" && !data.startDate) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Informe o início do projeto." });
    }
    if (data.model === "recorrente" && data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O fim não pode ser antes do início." });
    }
  });

export const financialsSchema = z.object({
  contractValue: money,
  paymentTerms: z.string().trim().max(500, "Use até 500 caracteres."),
});

export const stageSchema = z.object({ id: z.string().uuid(), stage: z.enum(PROJECT_STAGES) });

/** Edição inline da visão geral do projeto — tudo opcional, valida só o que vier preenchido. */
export const updateProjectSchema = z.object({
  stage: z.enum(PROJECT_STAGES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  ownerId: z.string().uuid().optional(),
  contactId: z.string().uuid().nullable().optional(),
  serviceTypes: z.array(z.enum(SERVICE_TYPES)).max(SERVICE_TYPES.length).optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  briefing: z.string().trim().max(4000, "Use até 4000 caracteres.").nullable().optional(),
  productionNotes: z.string().trim().max(2000, "Use até 2000 caracteres.").nullable().optional(),
  deliveryNotes: z.string().trim().max(2000, "Use até 2000 caracteres.").nullable().optional(),
  locationAddress: z.string().trim().max(300, "Use até 300 caracteres.").nullable().optional(),
  locationNotes: z.string().trim().max(1000, "Use até 1000 caracteres.").nullable().optional(),
  driveFolderUrl: z.string().trim().max(500, "Use até 500 caracteres.").nullable().optional(),
  includedRevisionRounds: z.number().int().min(0).max(99).nullable().optional(),
});

export const updateProjectMembersSchema = z.object({
  id: z.string().uuid(),
  memberIds: z.array(z.string().uuid()),
});

export type ProjectValues = z.infer<typeof projectSchema>;
export type ProjectCostValues = z.infer<typeof costSchema>;
export type FinancialsValues = z.infer<typeof financialsSchema>;
export type UpdateProjectValues = z.infer<typeof updateProjectSchema>;

export function parseMoney(value: string): number | null {
  return value === "" ? null : Number(value.replace(",", "."));
}
