import { NextResponse } from "next/server";
import { z } from "zod";
import { googleConfigured, syncAllGoogleAccounts } from "@/lib/google/calendar.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Chamado pelo banco a cada 15 min (pg_cron → pg_net) com o id de um job. Sem segredo: só roda
 * job pendente e recente, reivindicado de forma atômica.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!googleConfigured()) return NextResponse.json({ ok: false, reason: "Google não configurado" }, { status: 503 });

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("google_sync_jobs")
    .update({ status: "rodando" })
    .eq("id", parsed.data.id)
    .eq("status", "pendente")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select("id")
    .maybeSingle();
  if (!job) return NextResponse.json({ ok: true, skipped: true });

  try {
    const changes = await syncAllGoogleAccounts();
    await admin.from("google_sync_jobs").update({ status: "concluido", finished_at: new Date().toISOString(), detail: `${changes} mudanças` }).eq("id", job.id);
    return NextResponse.json({ ok: true, changes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro";
    await admin.from("google_sync_jobs").update({ status: "erro", finished_at: new Date().toISOString(), detail: message.slice(0, 500) }).eq("id", job.id);
    return NextResponse.json({ ok: false, reason: message }, { status: 500 });
  }
}
