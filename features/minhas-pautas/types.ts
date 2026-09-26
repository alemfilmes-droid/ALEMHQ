import type { PautaWithDetails } from "@/types";

/** Quadro pessoal agrupado por urgência (prazo), mais os dois grupos fixos do rodapé. */
export interface MyPautasBoard {
  atrasadas: PautaWithDetails[];
  hoje: PautaWithDetails[];
  estaSemana: PautaWithDetails[];
  depois: PautaWithDetails[];
  /** Lidera, mas quem está com a bola agora é outra pessoa. */
  acompanhando: PautaWithDetails[];
  /** Passou adiante nos últimos 7 dias — só leitura. */
  devolvidas: PautaWithDetails[];
  /** Já entregues/aprovadas: fora dos grupos de prazo (nunca "atrasadas"). As mais recentes primeiro. */
  entregues: PautaWithDetails[];
}

export interface MyPautasSummary {
  atrasadas: number;
  hoje: number;
  estaSemana: number;
  acompanhando: number;
}
