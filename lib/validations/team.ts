import { z } from "zod";
import { ORG_LEVELS } from "@/lib/auth/org";
import { ACCESS_ROLES, PRODUCTION_FUNCTIONS } from "@/lib/auth/roles";
import { SQUADS } from "@/lib/auth/squads";

const accessRole = z.enum(ACCESS_ROLES, { message: "Selecione o papel." });
const functions = z.array(z.enum(PRODUCTION_FUNCTIONS)).max(PRODUCTION_FUNCTIONS.length);
const squads = z.array(z.enum(SQUADS)).max(SQUADS.length);

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("Informe um e-mail válido.")
    .transform((value) => value.toLowerCase()),
  accessRole,
  functions,
  squads,
});

export const updateMemberSchema = z.object({
  id: z.string().uuid(),
  accessRole,
  functions,
  squads,
  jobTitle: z.string().trim().max(60, "Use até 60 caracteres."),
  // Opcional: quem não tem gestão de hierarquia sobre a pessoa simplesmente não envia este campo
  // (a action ignora silenciosamente — a RLS/trigger no banco são a barreira real).
  orgLevel: z.enum(ORG_LEVELS).optional(),
});

export const transferMasterSchema = z.object({ newMasterId: z.string().uuid() });

export const setMemberActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

export const setFinanceAccessSchema = z.object({
  id: z.string().uuid(),
  granted: z.boolean(),
});

export const invitationIdSchema = z.object({ id: z.string().uuid() });

export type InviteMemberValues = z.input<typeof inviteMemberSchema>;
export type UpdateMemberValues = z.input<typeof updateMemberSchema>;
