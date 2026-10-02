import { NextResponse } from "next/server";
import { z } from "zod";
import { checkVapidKeys, ensureWebPush, webpush } from "@/lib/push.server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Squad } from "@/types";

/** Diagnóstico: diz se as chaves VAPID da Vercel estão certas (sem mostrar as chaves). */
export function GET() {
  return NextResponse.json({ ...checkVapidKeys(), serverKey: describeServerKey() }, { headers: { "Cache-Control": "no-store" } });
}

/** Tipo da chave do Supabase no servidor (nunca a chave): o push precisa da service role. */
function describeServerKey(): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) return "ausente";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable (errada)";
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()) as { role?: string };
    return payload.role === "service_role" ? "service_role" : `${payload.role ?? "desconhecida"} (errada)`;
  } catch {
    return "formato desconhecido";
  }
}

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Cor do squad no push. O iPhone não permite mudar a cor/fundo do cartão da notificação, então o
 * título começa com o círculo na cor do squad (as mesmas cores do sistema).
 */
const SQUAD_MARK: Record<Squad, string> = {
  comercial: "🟠",
  audiovisual: "🟡",
  financeiro: "🟢",
  diretoria: "🔴",
};

async function squadOf(
  admin: ReturnType<typeof createAdminClient>,
  notification: { type: string; entity_type: string | null; entity_id: string | null },
): Promise<Squad | null> {
  const type = notification.type;
  if (notification.entity_type === "pauta" && notification.entity_id) {
    const { data } = await admin.from("pautas").select("squad").eq("id", notification.entity_id).maybeSingle();
    return data?.squad ?? null;
  }
  if (type.startsWith("finance") || type === "project_payment_check" || type === "payable" || type === "receivable") return "financeiro";
  if (type.startsWith("deal") || type.startsWith("crm") || type === "qualificado") return "comercial";
  if (type.startsWith("announcement")) return "diretoria";
  if (type.startsWith("project")) return "audiovisual";
  return null;
}

/**
 * Chamado pelo banco (pg_net) a cada notificação nova. Não há segredo: a notificação é
 * "reivindicada" de forma atômica (pushed_at nulo e criada há menos de 10 min) e só então enviada —
 * chamadas repetidas ou forjadas não geram push duplicado nem de algo inexistente.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!ensureWebPush()) return NextResponse.json({ ok: false, reason: "push desativado" }, { status: 503 });

  const admin = createAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: notification, error: claimError } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("pushed_at", null)
    .gte("created_at", tenMinutesAgo)
    .select("id, recipient_id, type, title, body, url, entity_type, entity_id")
    .maybeSingle();
  if (claimError) {
    console.error("[push] falha ao reivindicar", claimError.code, claimError.message);
    return NextResponse.json({ ok: false, reason: claimError.message }, { status: 500 });
  }
  if (!notification) return NextResponse.json({ ok: true, sent: 0, reason: "já enviada, antiga ou inexistente" });

  const [{ data: subscriptions }, { count: unread }] = await Promise.all([
    admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", notification.recipient_id),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", notification.recipient_id).is("read_at", null),
  ]);

  const squad = await squadOf(admin, notification);
  const payload = JSON.stringify({
    id: notification.id,
    title: squad ? `${SQUAD_MARK[squad]} ${notification.title}` : notification.title,
    squad,
    body: notification.body ?? "",
    url: notification.url ?? "/inicio",
    unread: unread ?? undefined,
  });

  let sent = 0;
  const gone: string[] = [];
  const failures: { status: number | null; reason: string }[] = [];
  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        sent += 1;
      } catch (error) {
        const { statusCode, body, message } = error as { statusCode?: number; body?: string; message?: string };
        // Motivo da recusa (sem dados da pessoa) para diagnóstico nos logs e na resposta.
        failures.push({ status: statusCode ?? null, reason: String(body || message || "erro").slice(0, 200) });
        console.error("[push] envio recusado", statusCode, body || message);
        // Aparelho desinstalou o app ou revogou a permissão: a inscrição morreu.
        if (statusCode === 404 || statusCode === 410) gone.push(subscription.id);
      }
    }),
  );
  if (gone.length > 0) await admin.from("push_subscriptions").delete().in("id", gone);

  return NextResponse.json({ ok: true, sent, failures });
}
