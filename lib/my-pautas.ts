import { pautaUrgency, type PautaUrgency } from "@/lib/pautas";
import type { PautaWithDetails } from "@/types";

/** Grupos do quadro pessoal calculados aqui (devolvidas vem de consulta própria, à parte). */
export interface MyPautasBuckets {
  atrasadas: PautaWithDetails[];
  hoje: PautaWithDetails[];
  estaSemana: PautaWithDetails[];
  depois: PautaWithDetails[];
  acompanhando: PautaWithDetails[];
  entregues: PautaWithDetails[];
}

export interface BucketContext {
  profileId: string;
  /** Negócios com pedido de direcionamento aberto para a pessoa: a pauta do negócio é tarefa dela. */
  requestDealIds: readonly string[];
  urgency?: (dueDate: string | null) => PautaUrgency;
}

function sortByDueDate(rows: PautaWithDetails[]): PautaWithDetails[] {
  return [...rows].sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"));
}

/**
 * A pessoa age na pauta quando a bola está com ela (responsável atual), quando ninguém está com a bola
 * e ela participa, ou quando há direcionamento pedido a ela. Com a bola em outra pessoa (passou adiante,
 * ou só lidera), a pauta vai para "Acompanhando" — ela acompanha, o prazo é de quem está com a bola.
 */
export function actsOn(pauta: PautaWithDetails, context: BucketContext): boolean {
  if (pauta.current_assignee_id === context.profileId) return true;
  if (pauta.source === "crm" && pauta.deal_id && context.requestDealIds.includes(pauta.deal_id)) return true;
  return pauta.current_assignee_id === null;
}

/**
 * Puro: o MESMO agrupamento no servidor (carga da página) e na tela (logo depois de mover/passar
 * adiante), para a pauta trocar de grupo na hora, sem esperar recarregar.
 */
export function bucketMyPautas(pautas: readonly PautaWithDetails[], context: BucketContext): MyPautasBuckets {
  const urgency = context.urgency ?? pautaUrgency;
  const buckets: MyPautasBuckets = { atrasadas: [], hoje: [], estaSemana: [], depois: [], acompanhando: [], entregues: [] };

  for (const pauta of pautas) {
    // Entregue/aprovada já terminou: nunca entra em "atrasadas", "hoje" etc., só no grupo próprio.
    if (pauta.board_column === "entregue" || pauta.status === "aprovado") {
      buckets.entregues.push(pauta);
      continue;
    }
    if (!actsOn(pauta, context)) {
      buckets.acompanhando.push(pauta);
      continue;
    }
    switch (urgency(pauta.due_date)) {
      case "atrasada":
        buckets.atrasadas.push(pauta);
        break;
      case "hoje":
        buckets.hoje.push(pauta);
        break;
      case "esta_semana":
        buckets.estaSemana.push(pauta);
        break;
      default:
        buckets.depois.push(pauta);
    }
  }

  return {
    atrasadas: sortByDueDate(buckets.atrasadas),
    hoje: sortByDueDate(buckets.hoje),
    estaSemana: sortByDueDate(buckets.estaSemana),
    depois: sortByDueDate(buckets.depois),
    acompanhando: sortByDueDate(buckets.acompanhando),
    // As 50 entregues mais recentes bastam para consulta rápida; o histórico completo está no projeto.
    entregues: [...buckets.entregues].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 50),
  };
}

/**
 * Edição feita na tela (otimista) vale até o servidor mandar uma versão igual ou mais nova da pauta —
 * assim uma edição antiga nunca esconde o que outra pessoa mudou depois.
 */
export function mergeOverride(server: PautaWithDetails, override: PautaWithDetails | undefined): PautaWithDetails {
  if (!override) return server;
  if (server.updated_at && override.updated_at && server.updated_at > override.updated_at) return server;
  return { ...server, ...override };
}
