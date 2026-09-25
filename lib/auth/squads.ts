import type { Squad } from "@/types";

export const SQUADS = ["diretoria", "comercial", "audiovisual", "financeiro"] as const satisfies readonly Squad[];

export const SQUAD_LABELS: Record<Squad, string> = {
  diretoria: "Diretoria",
  comercial: "Comercial",
  audiovisual: "Audiovisual",
  financeiro: "Financeiro",
};
