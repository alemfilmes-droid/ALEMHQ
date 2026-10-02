"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const schema = z.object({ sdrId: z.string().uuid().nullable(), reviewerId: z.string().uuid().nullable() });

export async function saveProspectSettingsAction(values: z.infer<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise os campos." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .update({ prospect_sdr_id: parsed.data.sdrId, prospect_reviewer_id: parsed.data.reviewerId, updated_by: profile.id })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Só a diretoria altera essa configuração." };
  revalidatePath("/configuracoes");
  return { ok: true, message: "Prospecção automática salva." };
}
