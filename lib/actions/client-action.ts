import type { ActionResult } from "@/types";

/**
 * Resultado de uma ação chamada pela tela. Além do ActionResult do servidor, cobre a falha que
 * nunca chega a ser uma resposta: sem internet, app fechado no meio do envio, ou a tela aberta
 * desde antes de uma publicação nova (a função antiga não existe mais no servidor).
 */
export type ClientActionResult = ActionResult | { ok: false; error: string; needsReload: true };

const STALE_DEPLOY = [/failed to find server action/i, /unrecognizedactionerror/i, /older or newer deployment/i, /server action .* not found/i];
const NETWORK = [/failed to fetch/i, /load failed/i, /networkerror/i, /network connection was lost/i, /network request failed/i, /internet connection appears to be offline/i, /aborted/i];

export const STALE_DEPLOY_MESSAGE = "O HQ foi atualizado enquanto esta tela estava aberta. Nada foi salvo: recarregue e faça de novo.";
export const NETWORK_MESSAGE = "Sem conexão com o servidor. Nada foi salvo: confira a internet e tente de novo.";
export const UNKNOWN_MESSAGE = "Algo deu errado e nada foi salvo. Tente de novo; se repetir, recarregue a página.";

/** Traduz a exceção de uma chamada que não voltou em mensagem em português (pura, testável). */
export function describeActionFailure(error: unknown): ClientActionResult {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  if (STALE_DEPLOY.some((pattern) => pattern.test(text))) return { ok: false, error: STALE_DEPLOY_MESSAGE, needsReload: true };
  if (NETWORK.some((pattern) => pattern.test(text))) return { ok: false, error: NETWORK_MESSAGE };
  return { ok: false, error: UNKNOWN_MESSAGE };
}

/** Chama a ação do servidor sem deixar erro escapar calado: sempre devolve um resultado. */
export async function runAction<T extends ActionResult>(call: () => Promise<T>): Promise<T | ClientActionResult> {
  try {
    return await call();
  } catch (error) {
    console.error("Ação falhou antes de responder:", error);
    return describeActionFailure(error);
  }
}

export function needsReload(result: ClientActionResult): boolean {
  return !result.ok && "needsReload" in result;
}
