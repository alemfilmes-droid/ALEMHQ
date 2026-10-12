import type { CadenceState, CadenceStatus } from "@/lib/prospeccao/cadence";

export const CADENCE_STATUS_LABELS: Record<CadenceStatus, string> = {
  atrasado: "Atrasado",
  chamar_hoje: "Chamar hoje",
  reativar: "Reativar",
  em_cadencia: "Em cadência",
  aguardando_decisor: "Aguardando decisor",
  em_conversa: "Em conversa",
  reuniao_marcada: "Reunião marcada",
  sem_resposta: "Sem resposta",
  pausado: "Pausado",
  descartado: "Descartado",
};

/**
 * Cores da spec (seção 8), sempre junto do texto. Contraste AA sobre o fundo escuro do HQ; o
 * vermelho da marca nunca aparece aqui.
 */
export const CADENCE_STATUS_CLASSES: Record<CadenceStatus, string> = {
  atrasado: "border-[#F5A524] bg-[#F5A524] text-[#1A1100]",
  chamar_hoje: "border-[#3B82F6] bg-[#3B82F6]/15 text-[#BFDBFE]",
  reativar: "border-[#22D3EE]/70 bg-[#22D3EE]/10 text-[#A5F3FC]",
  em_cadencia: "border-[#525252] bg-[#262626] text-[#D4D4D4]",
  aguardando_decisor: "border-[#525252] bg-[#262626] text-[#D4D4D4]",
  em_conversa: "border-[#22C55E] bg-[#22C55E]/15 text-[#BBF7D0]",
  reuniao_marcada: "border-[#A855F7] bg-[#A855F7]/15 text-[#E9D5FF]",
  sem_resposta: "border-[#3A3A3A] bg-transparent text-[#A3A3A3]",
  pausado: "border-[#525252] bg-transparent text-[#D4D4D4]",
  descartado: "border-[#3A3A3A] bg-transparent text-[#A3A3A3]",
};

/** "Toque 2 de 4", "Toque 0", "Reativação" — ou nulo quando não há envio pendente. */
export function touchLabel(state: CadenceState): string | null {
  if (state.isReactivation) return "Reativação";
  if (state.currentTouch === null) return null;
  if (state.currentTouch === 0) return "Toque 0";
  return `Toque ${state.currentTouch} de ${state.totalTouches}`;
}
