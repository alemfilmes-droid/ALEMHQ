import { DEAL_STAGES, PROSPECTION_GOALS, TEMPERATURES, type Temperature } from "@/features/crm/labels";
import { resolveBoardPeriod } from "@/features/crm/period";
import type { DealFilters } from "@/features/crm/types";
import { COMPANY_SOURCES } from "@/lib/domain";
import type { CompanySource, DealStage, ProspectionGoal } from "@/types";

function list(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function narrow<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

function money(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const number = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

/** searchParams da URL → filtros. O período (padrão: este mês) vale só para as colunas Ganho/Perdido. */
export function parseDealFilters(params: Record<string, string | undefined>): DealFilters {
  return {
    stage: narrow<DealStage>(list(params.etapa), DEAL_STAGES),
    goal: narrow<ProspectionGoal>(list(params.objetivo), PROSPECTION_GOALS),
    ownerId: list(params.sdr),
    responsibleId: list(params.responsavel),
    source: narrow<CompanySource>(list(params.origem), COMPANY_SOURCES),
    temperature: narrow<Temperature>(list(params.temperatura), TEMPERATURES),
    minValue: money(params.valorMin),
    maxValue: money(params.valorMax),
    period: resolveBoardPeriod(params.periodo, params.de, params.ate),
    search: params.busca,
  };
}
