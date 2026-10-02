import { after, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { connectGoogleAccount, GoogleAuthError, syncGoogleForProfile } from "@/lib/google/calendar.server";

const STATE_COOKIE = "alem_google_state";

/** Volta do Google: confere o state (mesma pessoa, mesmo navegador), grava a conta e sincroniza. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const done = (status: string) => {
    const response = NextResponse.redirect(new URL(`/configuracoes?google=${status}#google-agenda`, request.url));
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return response;
  };

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", request.url));

  const cookie = request.headers.get("cookie")?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];
  const [expectedState, expectedProfile] = decodeURIComponent(cookie ?? "").split(".");
  const state = url.searchParams.get("state");
  if (!state || !expectedState || state !== expectedState || expectedProfile !== profile.id) return done("erro");
  if (url.searchParams.get("error")) return done("cancelado");

  const code = url.searchParams.get("code");
  if (!code) return done("erro");

  try {
    await connectGoogleAccount(profile.id, code);
  } catch (error) {
    console.error("[google] conexão falhou", error instanceof GoogleAuthError ? error.message : error);
    return done("erro");
  }

  // Primeira sincronização depois da resposta (a pessoa já volta para as configurações).
  after(() => syncGoogleForProfile(profile.id));
  return done("conectado");
}
