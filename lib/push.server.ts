import "server-only";
import webpush from "web-push";

let configured: boolean | null = null;

/** Configura o web-push com as chaves VAPID. Sem chaves (ambiente sem push), devolve false. */
export function ensureWebPush(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:contato@alemfilmes.com.br";
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  return configured;
}

export { webpush };
