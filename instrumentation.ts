import type { Instrumentation } from "next";
import { requestErrorLog } from "@/lib/observability/request-error";

// Valida as variáveis de ambiente na inicialização do servidor.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env.server");
  }
}

/**
 * Todo erro no servidor (página, ação, rota) vai para o log da Vercel com a rota, o papel/squads de quem estava
 * logado e o código do erro — o mesmo "digest" que a tela de erro mostra para a pessoa.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error("[hq:error]", JSON.stringify(requestErrorLog(error, request, context)));
};
