import { addDays, startOfWeek, todayInAppZone } from "@/lib/calendar";

/**
 * Metas de esforço do SDR (spec 7.3), calculadas dos dados: toques enviados no dia e reuniões
 * marcadas na semana (segunda a domingo), sempre no dia de Fortaleza. Toques desfeitos e reuniões
 * canceladas já não existem nas listas (o banco apaga), então não contam.
 */

export interface SentBy {
  at: string;
  by: string | null;
}

const dayOf = (iso: string) => todayInAppZone(new Date(iso));

/** Toques de `userId` (todos, se nulo) no dia `day`. */
export function touchesOnDay(touches: readonly SentBy[], userId: string | null, day: string): number {
  return touches.filter((touch) => (userId === null || touch.by === userId) && dayOf(touch.at) === day).length;
}

/** Reuniões marcadas por `userId` (todos, se nulo) na semana de `day`. */
export function meetingsInWeek(meetings: readonly SentBy[], userId: string | null, day: string): number {
  const monday = startOfWeek(day);
  const sunday = addDays(monday, 6);
  return meetings.filter((meeting) => {
    const created = dayOf(meeting.at);
    return (userId === null || meeting.by === userId) && created >= monday && created <= sunday;
  }).length;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** "12 de 20 toques hoje · 3 de 5 reuniões na semana" (alvo zero = meta desligada, só o número). */
export function effortLine(touches: number, touchTarget: number, meetings: number, meetingTarget: number): string {
  const touchText = touchTarget > 0 ? `${touches} de ${touchTarget} toques hoje` : `${touches} ${plural(touches, "toque", "toques")} hoje`;
  const meetingText =
    meetingTarget > 0 ? `${meetings} de ${meetingTarget} reuniões na semana` : `${meetings} ${plural(meetings, "reunião", "reuniões")} na semana`;
  return `${touchText} · ${meetingText}`;
}
