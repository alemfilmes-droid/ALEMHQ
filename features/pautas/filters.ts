import type { PautaFilters } from "@/features/pautas/types";
import { SQUADS } from "@/lib/auth/squads";
import { PRIORITIES } from "@/lib/domain";
import { PAUTA_STATUSES } from "@/lib/pautas";

/** Chaves da URL de /pautas, na ordem das seções do popover. */
export const PAUTA_FILTER_KEYS = ["prioridade", "status", "squad", "lider", "responsavel", "cliente", "projeto"] as const;

function list(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function narrow<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ids(value: string | undefined): string[] {
  return list(value).filter((item) => UUID.test(item));
}

/** searchParams → filtros validados (valores fora da lista são descartados, não quebram a query). */
export function parsePautaFilters(params: Record<string, string | undefined>): PautaFilters {
  return {
    priorities: narrow(list(params.prioridade), PRIORITIES),
    statuses: narrow(list(params.status), PAUTA_STATUSES),
    squads: narrow(list(params.squad), SQUADS),
    leadIds: ids(params.lider),
    assigneeIds: ids(params.responsavel),
    companyIds: ids(params.cliente),
    projectIds: ids(params.projeto),
    search: params.busca?.trim() || undefined,
  };
}

/** Chave estável dos filtros — remonta o quadro quando muda (o estado otimista local é descartado). */
export function pautaFiltersKey(filters: PautaFilters): string {
  return JSON.stringify([
    filters.priorities,
    filters.statuses,
    filters.squads,
    filters.leadIds,
    filters.assigneeIds,
    filters.companyIds,
    filters.projectIds,
    filters.search ?? "",
  ]);
}
