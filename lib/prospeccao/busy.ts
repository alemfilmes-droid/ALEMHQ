import type { Interval } from "@/lib/prospeccao/slots";

/**
 * Fontes de "ocupado" da agenda do Anderson (spec 7.1). Hoje: Google e compromissos do HQ. A
 * sincronização das pautas da WAWS entra depois como mais uma fonte, sem mexer no resto.
 */
export interface BusySource {
  label: string;
  /** Lança erro quando não consegue ler; a sugestão de horários não segue sem todas as fontes. */
  load: (from: Date, to: Date) => Promise<Interval[]>;
}

export type BusyResult = { ok: true; busy: Interval[] } | { ok: false; error: string };

export const CALENDAR_UNAVAILABLE = "Não consegui acessar a agenda do Anderson agora. Tente de novo em instantes.";

export async function collectBusy(sources: readonly BusySource[], from: Date, to: Date): Promise<BusyResult> {
  const results = await Promise.allSettled(sources.map((source) => source.load(from, to)));
  if (results.some((result) => result.status === "rejected")) return { ok: false, error: CALENDAR_UNAVAILABLE };
  return { ok: true, busy: results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])) };
}
