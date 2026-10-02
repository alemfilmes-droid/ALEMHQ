import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessRouteFor,
  DEFAULT_ROUTE,
  isGuestOnlyRoute,
  isPublicRoute,
} from "@/lib/auth/permissions";
import { updateSession } from "@/lib/supabase/middleware";

function redirectTo(request: NextRequest, from: NextResponse, path: string, search?: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = search ?? "";
  const redirect = NextResponse.redirect(url);
  // Preserva cookies de sessão renovados/removidos.
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export async function middleware(request: NextRequest) {
  const { supabase, user, getResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // O handler de confirmação cria a sessão a partir do link do e-mail.
  if (pathname.startsWith("/auth/")) return getResponse();

  if (!user) {
    if (isPublicRoute(pathname)) return getResponse();
    const search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return redirectTo(request, getResponse(), "/login", search);
  }

  // RLS só devolve o profile de usuários ativos.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("access_role, full_name, has_finance_access, org_level, profile_squads(squad)")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileRow) {
    await supabase.auth.signOut();
    return redirectTo(request, getResponse(), "/login", "?erro=conta-desativada");
  }

  const { profile_squads, ...profile } = profileRow;
  const squads = profile_squads.map((row) => row.squad);

  if (pathname === "/") return redirectTo(request, getResponse(), DEFAULT_ROUTE);

  // Convite recém-aceito ainda sem nome: conclui o cadastro primeiro.
  if (!profile.full_name && pathname !== "/aceitar-convite") {
    return redirectTo(request, getResponse(), "/aceitar-convite");
  }

  if (isGuestOnlyRoute(pathname)) return redirectTo(request, getResponse(), DEFAULT_ROUTE);

  if (!isPublicRoute(pathname) && !canAccessRouteFor({ ...profile, squads }, pathname)) {
    // Quem não gerencia pautas cai no quadro pessoal, não na home — é o destino equivalente.
    // Mantém o ?pauta=… dos links antigos de notificação para abrir a pauta direto.
    const isPautas = pathname === "/pautas" || pathname.startsWith("/pautas/");
    const pautaId = isPautas ? request.nextUrl.searchParams.get("pauta") : null;
    return redirectTo(request, getResponse(), isPautas ? "/minhas-pautas" : DEFAULT_ROUTE, pautaId ? `?pauta=${encodeURIComponent(pautaId)}` : undefined);
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icons/|sw\\.js|manifest\\.webmanifest|api/push/dispatch|api/google/sync|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
