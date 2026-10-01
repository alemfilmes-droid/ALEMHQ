import { NextResponse } from "next/server";
import { z } from "zod";
import { checkVapidKeys, ensureWebPush, webpush } from "@/lib/push.server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Diagnóstico: diz se as chaves VAPID da Vercel estão certas (sem mostrar as chaves). */
export function GET() {
  return NextResponse.json(checkVapidKeys(), { headers: { "Cache-Control": "no-store" } });
}

const bodySchema = z.object({ id: z.string().uuid() });

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
  const { data: notification } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("pushed_at", null)
    .gte("created_at", tenMinutesAgo)
    .select("id, recipient_id, title, body, url")
    .maybeSingle();
  if (!notification) return NextResponse.json({ ok: true, sent: 0 });

  const [{ data: subscriptions }, { count: unread }] = await Promise.all([
    admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", notification.recipient_id),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", notification.recipient_id).is("read_at", null),
  ]);

  const payload = JSON.stringify({
    id: notification.id,
    title: notification.title,
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
