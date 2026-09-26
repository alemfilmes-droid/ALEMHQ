import { z } from "zod";
import { PRODUCTION_FUNCTIONS } from "@/lib/auth/roles";

/** Cadastro manual de freelancer (sem conta de acesso). */
export const freelancerSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome.").max(120, "Use até 120 caracteres."),
  phone: z.string().trim().max(30, "Use até 30 caracteres."),
  email: z
    .string()
    .trim()
    .max(200, "Use até 200 caracteres.")
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Informe um e-mail válido."),
  functions: z.array(z.enum(PRODUCTION_FUNCTIONS)).max(PRODUCTION_FUNCTIONS.length),
  city: z.string().trim().max(120, "Use até 120 caracteres."),
  notes: z.string().trim().max(2000, "Use até 2000 caracteres."),
});

export type FreelancerValues = z.infer<typeof freelancerSchema>;
