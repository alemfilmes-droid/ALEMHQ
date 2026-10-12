/**
 * Evento de domínio "orçamento aprovado" (spec 7.2 → 7.3). Orçamentos dispara depois de aprovar
 * um orçamento ligado a um negócio; o Módulo 4B registra o handler que soma na meta vinculada.
 * Um handler que falha não desfaz a aprovação nem impede os outros.
 */
export interface QuoteApprovedEvent {
  leadId: string;
  quoteId: string;
  /** Valor final do orçamento (R$). */
  amount: number;
}

export type QuoteApprovedHandler = (event: QuoteApprovedEvent) => Promise<void>;

const handlers = new Set<QuoteApprovedHandler>();

/** Registra quem reage à aprovação. Devolve a função que remove o registro. */
export function onQuoteApproved(handler: QuoteApprovedHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Dispara o evento; devolve quantos handlers falharam (a aprovação segue de qualquer jeito). */
export async function quoteApproved(event: QuoteApprovedEvent): Promise<number> {
  const results = await Promise.allSettled([...handlers].map((handler) => handler(event)));
  return results.filter((result) => result.status === "rejected").length;
}
