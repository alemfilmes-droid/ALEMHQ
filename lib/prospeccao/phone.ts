/**
 * Telefone para o WhatsApp (spec 9.1): só dígitos, 55 na frente. Sem DDD, assume 84 (Natal) e avisa.
 * Só aceita celular brasileiro (9 dígitos começando com 9) com DDD que existe.
 */

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53,
  54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96,
  97, 98, 99,
]);

export const DEFAULT_DDD = "84";

export type PhoneResult =
  | { ok: true; number: string; display: string; assumedDdd: boolean }
  | { ok: false; error: string };

function national(digits: string): { value: string; assumedDdd: boolean } | null {
  if (digits.length === 13 && digits.startsWith("55")) return { value: digits.slice(2), assumedDdd: false };
  if (digits.length === 12 && digits.startsWith("55")) return { value: digits.slice(2), assumedDdd: false };
  if (digits.length === 10 || digits.length === 11) return { value: digits, assumedDdd: false };
  if (digits.length === 8 || digits.length === 9) return { value: DEFAULT_DDD + digits, assumedDdd: true };
  return null;
}

export function normalizeWhatsapp(raw: string | null | undefined): PhoneResult {
  // Zeros à esquerda: prefixo de discagem (0 84…) não faz parte do número.
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return { ok: false, error: "Falta o número de WhatsApp." };
  const parts = national(digits);
  if (!parts) return { ok: false, error: "Número de WhatsApp com quantidade de dígitos inválida." };

  const ddd = parts.value.slice(0, 2);
  const local = parts.value.slice(2);
  if (!DDDS.has(Number(ddd))) return { ok: false, error: `O DDD ${ddd} não existe.` };
  if (local.length === 8) {
    return /^[2-5]/.test(local)
      ? { ok: false, error: "Parece telefone fixo: o WhatsApp precisa de um celular." }
      : { ok: false, error: "Celular precisa ter 9 dígitos, com o 9 na frente." };
  }
  if (!local.startsWith("9")) return { ok: false, error: "Celular precisa começar com 9." };

  return {
    ok: true,
    number: `55${ddd}${local}`,
    display: `+55 (${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`,
    assumedDdd: parts.assumedDdd,
  };
}
