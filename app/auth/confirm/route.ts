import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: readonly EmailOtpType[] = ["invite", "recovery", "email"];

/** Troca o token_hash do e-mail (convite ou recuperação) por uma sessão. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/login");

  const failure = request.nextUrl.clone();
  failure.pathname = "/login";
  failure.search = "?erro=link-invalido";

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return NextResponse.redirect(failure);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(failure);

  const success = request.nextUrl.clone();
  success.pathname = next;
  success.search = "";
  return NextResponse.redirect(success);
}
