/**
 * Dinheiro sempre em centavos inteiros no TypeScript. Nenhuma soma usa ponto flutuante:
 * o valor numeric do banco é convertido uma vez (toCents) e somado como inteiro.
 */
export type Cents = number;

export function toCents(value: number | null | undefined): Cents {
  return value == null ? 0 : Math.round(value * 100);
}

/** Valor para gravar em colunas numeric(12,2): sempre múltiplo exato de 1 centavo. */
export function centsToNumber(cents: Cents): number {
  return cents / 100;
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" → 123456.
 * Retorna null se o texto não for um valor monetário válido (máx. 2 casas decimais).
 */
export function parseMoneyToCents(input: string): Cents | null {
  let text = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (text === "") return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }

  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const [, whole = "0", fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 123456 → "1234,56" (valor para preencher campos de formulário). */
export function centsToInput(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

/** 123456 → "R$ 1.234,56" (somente exibição). */
export function formatCents(cents: Cents): string {
  return brl.format(cents / 100);
}

/** 123456789 → "R$ 1,2 mi" (eixos e rótulos de gráfico, onde o espaço é curto). */
export function formatCentsCompact(cents: Cents): string {
  return brlCompact.format(cents / 100);
}

/** Divide o total em N parcelas distribuindo os centavos: a soma é sempre exatamente o total. */
export function splitInstallments(totalCents: Cents, count: number): Cents[] {
  const base = Math.floor(totalCents / count);
  const extra = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}
