import type { DealInteractionKind } from "@/types";

/**
 * Histórico de abordagens (relatório do Paulo, item 03). Espelho das regras do banco
 * (crm_lock_interaction): só tentativas e respostas; o autor ou a diretoria/admin editam e riscam;
 * riscado não se edita de novo. Só a diretoria/admin abre o motivo de um registro riscado.
 */

export const EDITABLE_INTERACTION_KINDS: readonly DealInteractionKind[] = ["tentativa_contato", "resposta_cliente"];

export interface ApproachViewer {
  id: string;
  /** Diretoria ou admin (crm_is_ceo no banco). */
  isCeo: boolean;
}

export interface ApproachRecord {
  kind: DealInteractionKind;
  author_id: string | null;
  deleted_at: string | null;
}

export function canChangeApproach(record: ApproachRecord, viewer: ApproachViewer): boolean {
  if (record.deleted_at || !EDITABLE_INTERACTION_KINDS.includes(record.kind)) return false;
  return viewer.isCeo || (record.author_id !== null && record.author_id === viewer.id);
}

/** Registro riscado: todos veem o risco; só a diretoria/admin clica para ver motivo, quem e quando. */
export function canOpenStruckDetails(record: ApproachRecord, viewer: ApproachViewer): boolean {
  return record.deleted_at !== null && viewer.isCeo;
}

/** Riscados ficam fora de contagens (cadência, tentativas por canal, meta de toques). */
export function activeOnly<T extends { deleted_at: string | null }>(items: readonly T[]): T[] {
  return items.filter((item) => item.deleted_at === null);
}
