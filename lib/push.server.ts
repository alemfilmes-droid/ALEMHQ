import "server-only";
import { createECDH } from "node:crypto";
import webpush from "web-push";
import { cleanVapidKey } from "@/lib/push-keys";

let configured: boolean | null = null;

/** Configura o web-push com as chaves VAPID. Sem chaves (ambiente sem push), devolve false. */
export function ensureWebPush(): boolean {
  if (configured !== null) return configured;
  const { publicKey, privateKey, subject } = readKeys();
  configured = checkVapidKeys().ok;
  if (configured) webpush.setVapidDetails(subject, publicKey, privateKey);
  return configured;
}

function readKeys() {
  // A Apple recusa o push (403 BadJwtToken) se o "subject" vier com espaço, aspas ou fora do formato.
  const rawSubject = (process.env.VAPID_SUBJECT ?? "").replace(/["'\s]/g, "");
  return {
    publicKey: cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    privateKey: cleanVapidKey(process.env.VAPID_PRIVATE_KEY),
    subject: /^(mailto:[^@]+@[^@]+|https:\/\/.+)$/.test(rawSubject) ? rawSubject : "mailto:contato@alemfilmes.com.br",
  };
}

type KeyState = "ok" | "ausente" | "invalida";

/** Diagnóstico sem expor as chaves: formato de cada uma, se formam um par e se o subject é válido. */
export function checkVapidKeys(): { ok: boolean; publicKey: KeyState; privateKey: KeyState; pair: boolean; subject: "ok" | "padrao" } {
  const { publicKey, privateKey } = readKeys();
  const subject = /^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/.test((process.env.VAPID_SUBJECT ?? "").replace(/["'\s]/g, "")) ? "ok" : "padrao";
  const pub = Buffer.from(publicKey, "base64url");
  const priv = Buffer.from(privateKey, "base64url");
  const publicState: KeyState = !publicKey ? "ausente" : pub.length === 65 && pub[0] === 4 ? "ok" : "invalida";
  const privateState: KeyState = !privateKey ? "ausente" : priv.length === 32 ? "ok" : "invalida";
  let pair = false;
  if (publicState === "ok" && privateState === "ok") {
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(priv);
      pair = ecdh.getPublicKey().equals(pub);
    } catch {
      pair = false;
    }
  }
  return { ok: pair, publicKey: publicState, privateKey: privateState, pair, subject };
}

export { webpush };
