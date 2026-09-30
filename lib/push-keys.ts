/**
 * Limpa uma chave VAPID colada no painel da Vercel: tira aspas, espaços e quebras de linha e
 * converte base64 comum para base64url. Não valida — só normaliza.
 */
export function cleanVapidKey(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
