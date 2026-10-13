"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseMoneyToCents } from "@/features/finance/money";
import { canEditRemuneration } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MAX_PAYDAY, MIN_PAYDAY } from "@/lib/wallet/payout-date";
import { REMUNERATION_TYPES, type Remuneration } from "@/lib/wallet/wallet";
import type { ActionResult } from "@/types";

/** Remuneração da equipe: só o master lê para editar e grava (a RLS de profile_remuneration repete com is_master()). */

const FORBIDDEN: ActionResult = { ok: false, error: "Só o master define a remuneração da equipe." };

const schema = z
  .object({
    profileId: z.string().uuid(),
    type: z.enum(REMUNERATION_TYPES, { message: "Escolha o tipo de remuneração." }),
    fixedAmount: z.string().trim(),
    payday: z.number().int().min(MIN_PAYDAY, "Dia de pagamento de 1 a 28.").max(MAX_PAYDAY, "Dia de pagamento de 1 a 28."),
    commissionPercent: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    const fixed = data.type === "fixo" || data.type === "fixo_mais_variavel";
    if (fixed && (parseMoneyToCents(data.fixedAmount) ?? 0) <= 0) {
      ctx.addIssue({ code: "custom", path: ["fixedAmount"], message: "Informe o valor do fixo." });
    }
    if (data.commissionPercent !== "") {
      const value = Number(data.commissionPercent.replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > 100) ctx.addIssue({ code: "custom", path: ["commissionPercent"], message: "Use um percentual de 0 a 100." });
    }
  });

export type RemunerationValues = z.input<typeof schema>;

async function master() {
  const profile = await getCurrentProfile();
  return profile && canEditRemuneration(profile) ? profile : null;
}

export async function getRemunerationAction(profileId: string): Promise<Remuneration | null> {
  if (!(await master()) || !z.string().uuid().safeParse(profileId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_remuneration")
    .select("remuneration_type, fixed_amount_cents, payday, default_commission_percent")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data
    ? { type: data.remuneration_type, fixedAmountCents: data.fixed_amount_cents, payday: data.payday, defaultCommissionPercent: data.default_commission_percent }
    : null;
}

export async function saveRemunerationAction(values: RemunerationValues): Promise<ActionResult> {
  const actor = await master();
  if (!actor) return FORBIDDEN;
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;
  const fixed = d.type === "fixo" || d.type === "fixo_mais_variavel";

  const supabase = await createClient();
  const { error } = await supabase.from("profile_remuneration").upsert({
    profile_id: d.profileId,
    remuneration_type: d.type,
    fixed_amount_cents: fixed ? parseMoneyToCents(d.fixedAmount) : null,
    payday: d.payday,
    default_commission_percent: d.commissionPercent === "" ? null : Number(d.commissionPercent.replace(",", ".")),
    updated_at: new Date().toISOString(),
    updated_by: actor.id,
  });
  if (error) return { ok: false, error: "Não foi possível salvar a remuneração." };
  revalidatePath("/equipe");
  revalidatePath("/carteira");
  revalidatePath("/financeiro");
  return { ok: true, message: "Remuneração salva. A Carteira já usa o novo dia de pagamento." };
}
