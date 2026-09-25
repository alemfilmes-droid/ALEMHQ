import type { CookieOptions } from "@supabase/ssr";

/** Cookie que guarda a escolha "Lembrar deste dispositivo" ("0" = sessão do navegador). */
export const REMEMBER_COOKIE = "alem-remember";

/**
 * Sem "lembrar", os cookies de sessão do Supabase perdem maxAge/expires
 * e morrem ao fechar o navegador. Remoções (maxAge 0) são preservadas.
 */
export function applyRememberPolicy(options: CookieOptions, remember: boolean): CookieOptions {
  if (remember || !options.maxAge || options.maxAge <= 0) return options;
  return { ...options, maxAge: undefined, expires: undefined };
}
