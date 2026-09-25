import { z } from "zod";
import { TIERS } from "@/lib/domain";

export const CLIENT_HEALTHS = ["ativo", "atencao", "tensao", "churn"] as const;

export const updateHealthSchema = z.object({
  id: z.string().uuid(),
  health: z.enum(CLIENT_HEALTHS, { message: "Selecione a saúde do cliente." }),
  note: z.string().trim().max(300, "Use até 300 caracteres."),
});

export const updateTierSchema = z.object({
  id: z.string().uuid(),
  tier: z.enum(TIERS, { message: "Selecione o nível." }),
});

export type UpdateHealthValues = z.infer<typeof updateHealthSchema>;
export type UpdateTierValues = z.infer<typeof updateTierSchema>;
