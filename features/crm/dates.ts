import { addDaysISO, todayISO } from "@/features/finance/period";

/** Sugestão padrão de data para a próxima ação: amanhã (America/Fortaleza). */
export function tomorrowISO() {
  return addDaysISO(todayISO(), 1);
}

/** yyyy-mm-dd da data e "HH:mm" (America/Fortaleza) de um timestamptz — para preencher inputs de data/hora. */
export function splitTimestamp(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "09:00" };
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date(value));
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(value),
  );
  return { date, time };
}
