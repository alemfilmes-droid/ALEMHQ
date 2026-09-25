import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .email("Informe um e-mail válido.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Use no mínimo 8 caracteres.")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
  .regex(/\d/, "Inclua ao menos um número.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
  remember: z.boolean(),
});

export const forgotPasswordSchema = z.object({ email });

const passwordPair = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Confirme a senha."),
});

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const passwordsMatchIssue = { message: "As senhas não coincidem.", path: ["confirmPassword"] };

export const resetPasswordSchema = passwordPair.refine(passwordsMatch, passwordsMatchIssue);

export const acceptInviteSchema = passwordPair
  .extend({ fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120) })
  .refine(passwordsMatch, passwordsMatchIssue);

/** Mesmo formato do convite (nome ignorado), para o formulário compartilhado usar um único tipo. */
export const resetPasswordFormSchema = passwordPair
  .extend({ fullName: z.string() })
  .refine(passwordsMatch, passwordsMatchIssue);

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;
