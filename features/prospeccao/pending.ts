import "server-only";
import { loadMessageInput } from "@/features/prospeccao/message-queries";
import { buildMessage, checkFinalText } from "@/lib/prospeccao/message";
import type { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Guarda o texto que foi aberto no WhatsApp como rascunho do lead (um por lead; o novo substitui o
 * anterior). Toque, script e destinatário vêm do servidor; só o texto vem do card.
 */
export async function savePendingSend(supabase: Supabase, dealId: string, text: string): Promise<ActionResult> {
  const problem = checkFinalText(text);
  if (problem) return { ok: false, error: problem };
  const loaded = await loadMessageInput(supabase, dealId);
  const message = loaded ? buildMessage(loaded.input) : null;
  if (!message?.ok) return { ok: false, error: message?.error ?? "Lead fora da cadência." };

  const { error } = await supabase.from("prospect_pending_sends").upsert(
    {
      deal_id: dealId,
      touch_number: message.touchNumber,
      script_kind: message.scriptKind,
      script_id: message.scriptId,
      body: text,
      recipient: message.recipient,
      created_at: new Date().toISOString(),
    },
    { onConflict: "deal_id" },
  );
  return error ? { ok: false, error: "O WhatsApp abriu, mas o rascunho não foi salvo. Abra de novo antes de marcar enviado." } : { ok: true };
}
