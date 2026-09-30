"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

type Result = { ok: true } | { ok: false; error: string };

/** Liga este aparelho à pessoa logada (se o aparelho era de outra pessoa, passa a ser desta). */
export async function registerPushSubscriptionAction(input: unknown, userAgent: string | null): Promise<Result> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Inscrição inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: userAgent?.slice(0, 300) ?? undefined,
  });
  return error ? { ok: false, error: "Não foi possível ativar as notificações." } : { ok: true };
}

export async function unregisterPushSubscriptionAction(endpoint: string): Promise<Result> {
  if (typeof endpoint !== "string" || endpoint.length === 0) return { ok: false, error: "Inscrição inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unregister_push_subscription", { p_endpoint: endpoint });
  return error ? { ok: false, error: "Não foi possível desativar." } : { ok: true };
}
