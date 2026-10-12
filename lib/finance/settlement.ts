import type { ActionResult } from "@/types";

/** Estado atual do item quando a baixa não alterou nenhuma linha. */
export interface SettledRowState {
  /** paid_at (pagamento) ou received_at (recebimento). */
  settledOn: string | null;
  cancelledAt: string | null;
  settleKey: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSettleKey(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function brDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/**
 * A baixa só altera o item se ele ainda estiver em aberto (no máximo uma baixa por item). Quando
 * nada mudou, decide a resposta: a MESMA tentativa repetida (resposta anterior perdida no caminho)
 * é sucesso; baixa feita por outra tentativa ou item cancelado é um aviso claro, nunca uma 2ª baixa.
 */
export function resolveSettleConflict(row: SettledRowState | null, requestKey: string, noun: "pagamento" | "recebimento"): ActionResult {
  const label = noun === "pagamento" ? "Este pagamento" : "Este recebimento";
  if (!row) return { ok: false, error: `${label} não foi encontrado ou você não tem acesso a ele.` };
  if (row.settledOn && row.settleKey === requestKey) {
    return { ok: true, message: noun === "pagamento" ? "Pagamento registrado." : "Recebimento registrado." };
  }
  if (row.settledOn) return { ok: false, error: `${label} já tinha baixa em ${brDate(row.settledOn)}. Nada foi alterado.` };
  if (row.cancelledAt) return { ok: false, error: `${label} está cancelado. Nada foi alterado.` };
  return { ok: false, error: `Não foi possível registrar a baixa. Nada foi alterado: tente de novo.` };
}

/** Erros de regra do banco (motivo do atraso etc.) vão direto; o resto vira mensagem genérica. */
export function settleDbErrorMessage(error: { code?: string; message: string }, noun: "pagamento" | "recebimento"): string {
  if (error.code === "22023") return error.message;
  if (error.code === "42501") return "Você não tem permissão para dar baixa.";
  if (error.code === "23514") return "Algum campo está fora do formato aceito. Revise e tente de novo.";
  return `Não foi possível registrar o ${noun}. Nada foi alterado: tente de novo.`;
}
