/**
 * Registro de erro rastreável (aparece nos logs da Vercel): rota, caminho, papel e squads de quem estava logado,
 * o código do erro (ex.: 42501 do Postgres) e o "digest" que a tela de erro mostra para a pessoa. O middleware
 * repassa o contexto da pessoa em cabeçalhos internos (só para log — nunca para autorização).
 */

export const USER_CONTEXT_HEADERS = {
  id: "x-hq-user-id",
  role: "x-hq-role",
  orgLevel: "x-hq-org-level",
  squads: "x-hq-squads",
} as const;

export interface UserContext {
  id: string;
  role: string;
  orgLevel: string;
  squads: readonly string[];
}

export function userContextHeaders(user: UserContext): Record<string, string> {
  return {
    [USER_CONTEXT_HEADERS.id]: user.id,
    [USER_CONTEXT_HEADERS.role]: user.role,
    [USER_CONTEXT_HEADERS.orgLevel]: user.orgLevel,
    [USER_CONTEXT_HEADERS.squads]: user.squads.join(","),
  };
}

type HeaderBag = Record<string, string | string[] | undefined>;

function header(headers: HeaderBag, name: string): string | null {
  const value = headers[name];
  return (Array.isArray(value) ? value[0] : value) || null;
}

export interface ErrorDetails {
  name: string;
  message: string;
  /** Código do banco/PostgREST (ex.: 42501) quando houver. */
  code: string | null;
  details: string | null;
  hint: string | null;
  digest: string | null;
}

/** Erro qualquer (Error, PostgrestError do Supabase ou valor solto) → campos legíveis. */
export function errorDetails(error: unknown): ErrorDetails {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  return {
    name: error instanceof Error ? error.name : text(record.name) ?? typeof error,
    message: error instanceof Error ? error.message : text(record.message) ?? String(error),
    code: text(record.code) ?? (typeof record.code === "number" ? String(record.code) : null),
    details: text(record.details),
    hint: text(record.hint),
    digest: text(record.digest),
  };
}

export interface RequestErrorLog extends ErrorDetails {
  event: "request_error" | "client_error";
  route: string | null;
  path: string;
  method: string | null;
  routeType: string | null;
  user: { id: string | null; role: string | null; orgLevel: string | null; squads: string[] };
}

/** Linha de log de um erro no servidor (onRequestError em instrumentation.ts). */
export function requestErrorLog(
  error: unknown,
  request: { path: string; method: string; headers: HeaderBag },
  context: { routePath?: string; routeType?: string },
): RequestErrorLog {
  const squads = header(request.headers, USER_CONTEXT_HEADERS.squads);
  return {
    event: "request_error",
    route: context.routePath ?? null,
    path: request.path,
    method: request.method,
    routeType: context.routeType ?? null,
    user: {
      id: header(request.headers, USER_CONTEXT_HEADERS.id),
      role: header(request.headers, USER_CONTEXT_HEADERS.role),
      orgLevel: header(request.headers, USER_CONTEXT_HEADERS.orgLevel),
      squads: squads ? squads.split(",").filter(Boolean) : [],
    },
    ...errorDetails(error),
  };
}
