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

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
