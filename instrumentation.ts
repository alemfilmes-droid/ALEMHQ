// Valida as variáveis de ambiente na inicialização do servidor.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env.server");
  }
}
