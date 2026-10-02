import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { googleAuthUrl, googleConfigured } from "@/lib/google/calendar.server";

const STATE_COOKIE = "alem_google_state";

/** Inicia a conexão da PRÓPRIA conta Google (cada pessoa conecta a sua). */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/configuracoes?google=indisponivel#google-agenda", request.url));

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(googleAuthUrl(state, profile.email));
  response.cookies.set(STATE_COOKIE, `${state}.${profile.id}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return response;
}
