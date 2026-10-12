import "server-only";
import { sortQueue } from "@/features/prospeccao/queue-queries";
import type { QueueItem } from "@/features/prospeccao/types";
import { addDays } from "@/lib/calendar";
import { getCadenceState, type CadenceLead, type CadenceRules, type SentTouch } from "@/lib/prospeccao/cadence";
import type { HolidayCalendar } from "@/lib/prospeccao/time";

/**
 * Seis leads de demonstração para conferir a fila no servidor local (`npm run dev` + `?demo=1`).
 * Nada é gravado no banco: o estado sai do mesmo motor, com datas relativas a hoje.
 */
export function isDemoEnabled(flag: string | undefined): boolean {
  return process.env.NODE_ENV === "development" && flag === "1";
}

const SAZONAL: CadenceRules = { offsets: [0, 2, 5, 10], reactivationDays: 30, reactivationScriptEmpty: false, usesHouseClientScript: false };
const RELACIONAMENTO: CadenceRules = { offsets: [0, 3, 8, 15, 25], reactivationDays: 60, reactivationScriptEmpty: true, usesHouseClientScript: false };

const at = (day: string) => new Date(`${day}T10:00:00-03:00`).toISOString();

export function demoQueueItems(today: string, calendar: HolidayCalendar): QueueItem[] {
  const base: CadenceLead = {
    funnel: "aberto",
    contactIsDecisionMaker: true,
    decisionMakerSetAt: null,
    hook: "vi que vocês abriram a unidade de Parnamirim",
    lastDeliveredProject: null,
    cadenceStartedAt: at(today),
    repliedAt: null,
    pausedAt: null,
    resumedAt: null,
    discardedAt: null,
    manualReactivationOn: null,
    restartedAt: null,
    houseReturnOn: null,
    analysisReturnOn: null,
  };
  const touch = (touchNumber: number | null, day: string): SentTouch => ({ touchNumber, sentAt: at(day) });
  const fullSazonal = (lastDay: string) => [touch(1, addDays(lastDay, -14)), touch(2, addDays(lastDay, -12)), touch(3, addDays(lastDay, -7)), touch(4, lastDay)];

  const leads: { name: string; playbook: string; lead: CadenceLead; touches: SentTouch[]; rules: CadenceRules }[] = [
    { name: "Colégio Aurora (demo)", playbook: "Campanha de matrícula", lead: base, touches: [], rules: SAZONAL },
    {
      name: "Escola Mar Azul (demo)",
      playbook: "Espetáculos e eventos",
      lead: { ...base, cadenceStartedAt: at(addDays(today, -10)) },
      touches: [touch(1, addDays(today, -10))],
      rules: SAZONAL,
    },
    {
      name: "Instituto Dunas (demo)",
      playbook: "Conteúdo recorrente (escolas)",
      lead: { ...base, contactIsDecisionMaker: false },
      touches: [],
      rules: RELACIONAMENTO,
    },
    { name: "Clínica Sol (demo)", playbook: "Filme institucional", lead: { ...base, hook: null }, touches: [], rules: RELACIONAMENTO },
    {
      name: "Construtora Litoral (demo)",
      playbook: "Eventos e aftermovie",
      lead: { ...base, cadenceStartedAt: at(addDays(today, -40)) },
      touches: fullSazonal(addDays(today, -10)),
      rules: SAZONAL,
    },
    {
      name: "Colégio Potengi (demo)",
      playbook: "Campanha de matrícula",
      lead: { ...base, cadenceStartedAt: at(addDays(today, -60)) },
      touches: fullSazonal(addDays(today, -31)),
      rules: SAZONAL,
    },
  ];

  return sortQueue(
    leads.flatMap((item, index) => {
      const state = getCadenceState(item.lead, item.touches, item.rules, calendar, today);
      return state
        ? [{ dealId: `demo-${index + 1}`, leadName: item.name, title: item.playbook, playbookName: item.playbook, state, hasPending: false, phoneNotice: null, meeting: null, house: null, demo: true }]
        : [];
    }),
  );
}
