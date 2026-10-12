import type { DealStage } from "@/types";

/**
 * "Com a bola agora" (Bloco 5): quem conduz o negócio em cada etapa. Espelho de
 * public.crm_ball_for_stage (o banco aplica no gatilho de mudança de etapa); os casos ficam em
 * ball-cases.json e são conferidos nos dois lados. Direcionamento do CEO também devolve ao SDR
 * (deal_set_direction).
 */
export function ballForStage(
  stage: DealStage,
  people: { owner: string; ceo: string | null; attendee: string | null; current: string | null; fastTrack: boolean },
): string | null {
  switch (stage) {
    case "prospeccao":
    case "primeiro_contato":
    case "tentativas_contato":
    case "em_analise":
      return people.owner;
    case "qualificado":
      return people.ceo ?? people.owner;
    case "reuniao_agendada":
      return people.attendee ?? people.current;
    // Perdido volta para o SDR (decide o reaquecimento).
    case "perdido":
      return people.owner;
    // Depois da reunião continua com quem conduz (o Anderson envia a proposta se a reunião foi com ele);
    // o resultado da reunião devolve ao SDR nos outros caminhos. Venda direta: sempre o SDR.
    case "reuniao_realizada":
    case "proposta_enviada":
    case "negociacao":
      return people.fastTrack ? people.owner : (people.current ?? people.owner);
    case "ganho":
      return people.current;
  }
}
