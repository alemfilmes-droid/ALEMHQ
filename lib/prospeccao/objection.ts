import { isDateOnly } from "@/lib/calendar";
import type { ProspectObjectionAction } from "@/types";

/** O que o card faz depois de registrar a objeção (spec seção 5, coluna "Ação no HQ"). */
export type ObjectionFollowUp = "nada" | "pedir_data" | "novo_decisor";

export function objectionFollowUp(action: ProspectObjectionAction): ObjectionFollowUp {
  if (action === "pedir_data_reativacao") return "pedir_data";
  if (action === "novo_decisor") return "novo_decisor";
  return "nada";
}

/** Data da reativação pedida pelo cliente: só datas futuras. Nulo = válida. */
export function reactivationDateError(date: string, today: string): string | null {
  if (!isDateOnly(date)) return "Escolha uma data.";
  if (date <= today) return "Escolha uma data a partir de amanhã.";
  return null;
}
