import { DEFAULT_ROUTE } from "@/lib/auth/permissions";

/** Aceita apenas caminhos internos (evita open redirect). */
export function safeNextPath(next: string | null | undefined, fallback: string = DEFAULT_ROUTE) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
