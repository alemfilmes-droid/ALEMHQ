/**
 * Nada de credencial nos fluxogramas: senhas, logins e tokens ficam só no gerenciador de senhas da
 * empresa. Espelha public.text_has_credential() no banco (que bloqueia de novo ao salvar).
 */

const LABELED = /(senha|password|passwd|pwd|login|usu[aá]rio|user(name)?|token|api[ _-]?key|chave( de acesso| secreta)?|secret)\s*[:=]\s*\S+/i;
const BARE = /\b(token|password|senha)\b\s+(?=\S*\d)\S{8,}/i;

export const CREDENTIAL_WARNING =
  "Parece uma senha, login ou token. Credenciais nunca ficam no sistema: escreva “o login da empresa, disponível no gerenciador de senhas”.";

export const SAFE_ACCESS_TEXT = "o login da empresa, disponível no gerenciador de senhas";

export function hasCredential(text: string | null | undefined): boolean {
  if (!text) return false;
  return LABELED.test(text) || BARE.test(text);
}
