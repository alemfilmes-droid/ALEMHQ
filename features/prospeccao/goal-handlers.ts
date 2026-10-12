import "server-only";
import { onQuoteApproved } from "@/lib/prospeccao/events";
import { createClient } from "@/lib/supabase/server";

/**
 * Orçamento aprovado → a meta vinculada do lead soma na hora (spec 7.3). A conta em si é do banco
 * (goal_crm_candidates: chave budget:<id>, nunca duas vezes; reconcilia se o orçamento voltar atrás).
 */
onQuoteApproved(async ({ leadId }) => {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("prospect_goal_id").eq("id", leadId).maybeSingle();
  if (data?.prospect_goal_id) await supabase.rpc("goal_sync_crm", { p_goal_id: data.prospect_goal_id });
});
