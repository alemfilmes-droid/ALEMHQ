/** Normaliza campos livres de Instagram/site em URLs completas para abrir em nova aba. */

export function toInstagramUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, "").trim()}`;
}

export function toWebsiteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value.trim()}`;
}

/**
 * Emissor Nacional da NFS-e — onde o MEI emite nota fiscal de serviço (obrigatório desde 2023).
 * Usado pelo botão "Emitir NFS-e" no financeiro, no projeto e nas pautas de nota fiscal.
 */
export const NFSE_EMISSOR_URL = "https://www.nfse.gov.br/EmissorNacional";

/** Pauta/tarefa de nota fiscal pelo título ("Emitir NF", "nota fiscal", "NFS-e"…). */
export function isInvoiceTaskTitle(title: string): boolean {
  return /nota\s*fiscal|\bnfs-?e\b|\bnf\b|\bnfe\b/i.test(title);
}
