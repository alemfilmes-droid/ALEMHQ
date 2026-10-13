/**
 * Data em que um valor cai na Carteira: o primeiro dia do mês igual ao dia de pagamento da pessoa (1–28) que seja
 * ESTRITAMENTE depois do vencimento. Ex.: dia 10 → venc. 09/10 cai 10/10; venc. 10/10 cai 10/11; venc. 15/12 cai
 * 10/01. Datas só com dia (yyyy-mm-dd, horário de Fortaleza) — nada de UTC empurrando o dia 09 para o 10.
 * Espelha public.payout_date_for no banco (mesmos casos em payout-date-cases.json). Reaproveitada por CRM e Metas.
 */

export const MIN_PAYDAY = 1;
export const MAX_PAYDAY = 28;

export function isValidPayday(day: number): boolean {
  return Number.isInteger(day) && day >= MIN_PAYDAY && day <= MAX_PAYDAY;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function payoutDateFor(dueDate: string, payday: number): string {
  if (!isValidPayday(payday)) throw new RangeError("Dia de pagamento deve ser de 1 a 28.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) throw new RangeError("Vencimento inválido.");
  let year = Number(match[1]);
  let month = Number(match[2]);
  const day = Number(match[3]);
  if (day >= payday) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${pad(month)}-${pad(payday)}`;
}

/** Próximo dia de pagamento a partir de hoje (hoje conta, se for o dia). */
export function nextPayday(today: string, payday: number): string {
  const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
  return day <= payday ? `${year}-${pad(month)}-${pad(payday)}` : payoutDateFor(today, payday);
}
