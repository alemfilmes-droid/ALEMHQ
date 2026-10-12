import { addDays, appZoneToIso, todayInAppZone } from "@/lib/calendar";
import { nowInFortaleza } from "@/lib/prospeccao/time";

/**
 * Horário efetivo de um contato (relatório do Paulo, item 01). Padrão: agora. "Fiz em outro horário":
 * até 7 dias para trás, nunca no futuro — a mesma regra do banco (crm_effective_time). Tudo em
 * America/Fortaleza. A cadência e a meta de toques contam por este horário; o momento real do
 * registro fica guardado à parte (created_at).
 */

export const EFFECTIVE_MAX_DAYS_BACK = 7;
/** Folga para o relógio do celular adiantado. */
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

export interface EffectiveDefaults {
  date: string;
  time: string;
  minDate: string;
  maxDate: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Valores iniciais e limites do campo "Fiz em outro horário" (agora, em Fortaleza). */
export function effectiveDefaults(now: Date = new Date()): EffectiveDefaults {
  const local = nowInFortaleza(now);
  return {
    date: local.date,
    time: `${pad(local.hour)}:${pad(local.minute)}`,
    minDate: addDays(todayInAppZone(now), -EFFECTIVE_MAX_DAYS_BACK),
    maxDate: local.date,
  };
}

export type EffectiveResult = { ok: true; iso: string } | { ok: false; error: string };

/** Data + hora de Fortaleza → instante (ISO), conferindo o limite de 7 dias e o futuro. */
export function parseEffectiveTime(date: string, time: string, now: Date = new Date()): EffectiveResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "Informe a data e o horário do contato." };
  const iso = appZoneToIso(date, time);
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return { ok: false, error: "Informe a data e o horário do contato." };
  if (at > now.getTime() + FUTURE_TOLERANCE_MS) return { ok: false, error: "O horário do contato não pode ser no futuro." };
  if (at < now.getTime() - EFFECTIVE_MAX_DAYS_BACK * 24 * 60 * 60 * 1000) return { ok: false, error: "Só dá para registrar contatos de até 7 dias atrás." };
  return { ok: true, iso };
}
