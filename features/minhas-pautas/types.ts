import type { PautaWithDetails } from "@/types";

/** Quadro pessoal agrupado por urgência (prazo), mais os dois grupos fixos do rodapé. */
export interface MyPautasBoard {
  atrasadas: PautaWithDetails[];
  hoje: PautaWithDetails[];
  estaSemana: PautaWithDetails[];
  depois: PautaWithDetails[];
  /** Participa (lidera ou passou adiante), mas quem está com a bola agora é outra pessoa. */
  acompanhando: PautaWithDetails[];
  /** Passou adiante nos últimos 7 dias — só leitura. */
  devolvidas: PautaWithDetails[];
  /** Já entregues/aprovadas: fora dos grupos de prazo (nunca "atrasadas"). As mais recentes primeiro. */
  entregues: PautaWithDetails[];
  /** Negócios com direcionamento aberto para a pessoa — para a tela reagrupar com a mesma regra. */
  requestDealIds: string[];
}

export interface MyPautasSummary {
  atrasadas: number;
  hoje: number;
  estaSemana: number;
  acompanhando: number;
}
