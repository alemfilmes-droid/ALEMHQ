import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120, "Use até 120 caracteres."),
  phone: z
    .string()
    .trim()
    .max(20, "Use até 20 caracteres.")
    .regex(/^[+()\d\s-]*$/, "Use apenas números, espaços, +, ( ) e -.")
    .refine((value) => value === "" || value.replace(/\D/g, "").length >= 8, "Informe um telefone válido."),
});

export type ProfileValues = z.infer<typeof profileSchema>;

// Limites de imagem: fonte única em lib/uploads.ts (5 MB, JPG/PNG/WebP).
export { IMAGE_MAX_BYTES as AVATAR_MAX_BYTES, IMAGE_TYPES as AVATAR_TYPES } from "@/lib/uploads";
