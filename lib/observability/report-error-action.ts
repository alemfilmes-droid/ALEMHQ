"use server";

import { getCurrentProfile } from "@/lib/auth/session";
import { errorDetails, type RequestErrorLog } from "@/lib/observability/request-error";

/**
 * A tela de erro (no navegador) relata o que aconteceu: erros que só existem no navegador não passam pelo
 * onRequestError. Nunca falha — é só log.
 */
export async function reportClientErrorAction(input: { path: string; message: string; digest: string | null; name: string }): Promise<void> {
  try {
    const profile = await getCurrentProfile();
    const log: RequestErrorLog = {
      event: "client_error",
      route: null,
      path: String(input.path).slice(0, 500),
      method: null,
      routeType: null,
      user: { id: profile?.id ?? null, role: profile?.access_role ?? null, orgLevel: profile?.org_level ?? null, squads: profile?.squads ?? [] },
      ...errorDetails({ name: String(input.name).slice(0, 100), message: String(input.message).slice(0, 1000), digest: input.digest }),
    };
    console.error("[hq:error]", JSON.stringify(log));
  } catch {
    // Log nunca derruba nada.
  }
}
