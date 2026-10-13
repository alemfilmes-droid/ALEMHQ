/**
 * Itens do CRM na agenda (e no Google Agenda): a pauta-espelho de um negócio (prazo da próxima ação ou horário)
 * só aparece para quem está com a bola — e nunca para o CEO, mesmo com a bola. As reuniões "com Anderson" não
 * passam por aqui: são compromissos da agenda. Espelha public.crm_pauta_on_agenda_rule (mesmos casos em
 * crm-items-cases.json, conferidos no banco).
 */
export function crmPautaOnAgenda(assigneeId: string | null, people: readonly string[], ceoId: string | null): boolean {
  return assigneeId !== null && people.includes(assigneeId) && assigneeId !== ceoId;
}
