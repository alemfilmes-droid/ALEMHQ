import { z } from "zod";
import { ALL_COMPANY_LIFECYCLES, COMPANY_SOURCES } from "@/lib/domain";

const phone = z
  .string()
  .trim()
  .max(20, "Use até 20 caracteres.")
  .regex(/^[+()\d\s-]*$/, "Use apenas números, espaços, +, ( ) e -.");

export const companySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa.").max(120, "Use até 120 caracteres."),
  lifecycle: z.enum(ALL_COMPANY_LIFECYCLES),
  source: z.enum(COMPANY_SOURCES).or(z.literal("")),
  sourceDetail: z.string().trim().max(160, "Use até 160 caracteres."),
  document: z.string().trim().max(24, "Use até 24 caracteres."),
  city: z.string().trim().max(80, "Use até 80 caracteres."),
  instagram: z.string().trim().max(60, "Use até 60 caracteres."),
  website: z.string().trim().max(200, "Use até 200 caracteres."),
});

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome do contato.").max(120, "Use até 120 caracteres."),
  jobTitle: z.string().trim().max(80, "Use até 80 caracteres."),
  email: z.string().trim().email("Informe um e-mail válido.").or(z.literal("")),
  phone,
  isDecisionMaker: z.boolean(),
});

export const updateContactSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(2, "Informe o nome do contato.").max(120, "Use até 120 caracteres."),
  jobTitle: z.string().trim().max(80, "Use até 80 caracteres."),
  email: z.string().trim().email("Informe um e-mail válido.").or(z.literal("")),
  phone,
  isDecisionMaker: z.boolean(),
});

export type CompanyValues = z.infer<typeof companySchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type UpdateContactValues = z.infer<typeof updateContactSchema>;

/** Campos de texto opcionais vazios viram null no banco. */
export function nullIfEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
