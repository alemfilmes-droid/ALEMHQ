/** Normaliza um telefone BR livre em dígitos com DDI 55, para link do WhatsApp (wa.me). */
export function toWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}
