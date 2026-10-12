import { z } from "zod";
import { AUDIENCES } from "@/features/prospeccao/labels";

const phone = z
  .string()
  .trim()
  .max(20, "Use até 20 caracteres.")
  .regex(/^[+()\d\s-]*$/, "Use apenas números, espaços, +, ( ) e -.");

const text = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);

/** Campos de prospecção do lead (spec seção 6). Os do decisor são opcionais: dá para completar depois. */
export const prospectFieldsSchema = z.object({
  playbookId: z.string().uuid("Escolha o playbook."),
  leadType: z.enum(AUDIENCES),
  contactIsDecisionMaker: z.boolean(),
  decisionMakerName: text(120),
  decisionMakerRole: text(80),
  decisionMakerWhatsapp: phone,
  hook: text(120),
  goalId: z.string().uuid().nullable(),
  lastDeliveredProject: text(160),
});

export type ProspectFieldsValues = z.infer<typeof prospectFieldsSchema>;

/** Cadastro rápido: nome do lead, contato e WhatsApp, playbook e gancho. O resto o HQ calcula. */
export const quickLeadSchema = prospectFieldsSchema.extend({
  leadName: z.string().trim().min(2, "Informe o nome da escola ou empresa.").max(120, "Use até 120 caracteres."),
  contactName: z.string().trim().min(2, "Informe o nome do contato.").max(120, "Use até 120 caracteres."),
  whatsapp: phone.min(8, "Informe o WhatsApp."),
});

export type QuickLeadValues = z.infer<typeof quickLeadSchema>;

export const reasonSchema = z.string().trim().min(2, "Escreva o motivo.").max(300, "Use até 300 caracteres.");
