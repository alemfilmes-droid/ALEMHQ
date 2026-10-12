import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { savePendingSend } from "@/features/prospeccao/pending";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ dealId: z.string().uuid(), text: z.string().max(4000) });

/**
 * Rascunho do envio. É uma rota (e não server action) porque o card chama com fetch `keepalive`
 * no mesmo clique que abre o WhatsApp: no celular a página é trocada pelo app e só uma requisição
 * keepalive sobrevive a essa saída.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "prospectActions")) {
    return NextResponse.json({ ok: false, error: "Só o squad comercial envia mensagens da prospecção." }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Rascunho inválido." }, { status: 400 });

  const result = await savePendingSend(await createClient(), parsed.data.dealId, parsed.data.text);
  if (result.ok) revalidatePath("/crm");
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
