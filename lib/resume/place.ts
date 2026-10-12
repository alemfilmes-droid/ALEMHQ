/**
 * O iOS fecha o app da tela de início quando falta memória e, ao reabrir, ele volta para a página
 * inicial (/inicio). Guardamos a última tela (com filtros, que ficam na URL) e a rolagem, e a
 * reabertura volta para o mesmo lugar. Puro: a decisão fica testável; o armazenamento é do componente.
 */

export const LAST_PLACE_KEY = "alem-hq:last-place";
export const SCROLL_KEY_PREFIX = "alem-hq:scroll:";
/** Depois disso, abrir o app é começar o dia de novo: vai para o Início normalmente. */
export const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SavedPlace {
  route: string;
  at: number;
}

/** Rotas que não vale reabrir (login, impressão, callbacks). */
export function isResumableRoute(route: string): boolean {
  return route.startsWith("/") && !/^\/(login|esqueci-senha|redefinir-senha|aceitar-convite|auth|api|orcamentos\/[^/]+\/(apresentacao|nota))/.test(route);
}

export function parseSavedPlace(raw: string | null): SavedPlace | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "route" in value && "at" in value && typeof value.route === "string" && typeof value.at === "number") {
      return { route: value.route, at: value.at };
    }
  } catch {
    // Valor corrompido: ignora.
  }
  return null;
}

/**
 * Para onde ir ao abrir o app. Só reabre no lugar salvo quando: é o app da tela de início, é a
 * primeira tela desta abertura, a abertura caiu no Início (start_url) e o lugar é recente.
 */
export function resumeTarget(input: { standalone: boolean; freshLaunch: boolean; pathname: string; saved: SavedPlace | null; now: number }): string | null {
  const { standalone, freshLaunch, pathname, saved, now } = input;
  if (!standalone || !freshLaunch || pathname !== "/inicio" || !saved) return null;
  if (now - saved.at > RESUME_MAX_AGE_MS || !isResumableRoute(saved.route)) return null;
  return saved.route.split("?")[0] === "/inicio" ? null : saved.route;
}
