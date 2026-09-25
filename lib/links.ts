/** Normaliza campos livres de Instagram/site em URLs completas para abrir em nova aba. */

export function toInstagramUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, "").trim()}`;
}

export function toWebsiteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value.trim()}`;
}
