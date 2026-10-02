/**
 * Conta do orçamento (mesma regra na tela, na nota e na apresentação).
 *
 * Preço unitário ao cliente = custo × (1 + FEE%) ÷ (1 − imposto%) — o total ao cliente já embute o
 * FEE da empresa e o imposto. Um item pode ter o preço fixado à mão (override).
 * Por item: imposto = preço × imposto%; ganho = preço − custo − imposto.
 */

export type BudgetSection = "profissional" | "custo";

export interface BudgetLineInput {
  id: string;
  section: BudgetSection;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  unitPriceOverride: number | null;
}

export interface BudgetLine extends BudgetLineInput {
  unitPrice: number;
  price: number;
  cost: number;
  tax: number;
  profit: number;
  marginPct: number;
}

export interface BudgetTotals {
  price: number;
  cost: number;
  tax: number;
  profit: number;
  marginPct: number;
  bySection: Record<BudgetSection, { price: number; cost: number }>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function priceFactor(feePct: number, taxPct: number): number {
  const tax = Math.min(Math.max(taxPct, 0), 99.99) / 100;
  return (1 + Math.max(feePct, 0) / 100) / (1 - tax);
}

export function computeBudget(lines: BudgetLineInput[], feePct: number, taxPct: number): { lines: BudgetLine[]; totals: BudgetTotals } {
  const factor = priceFactor(feePct, taxPct);
  const taxRate = taxPct / 100;
  const computed = lines.map((line) => {
    const unitPrice = line.unitPriceOverride ?? round2(line.unitCost * factor);
    const price = round2(unitPrice * line.quantity);
    const cost = round2(line.unitCost * line.quantity);
    const tax = round2(price * taxRate);
    const profit = round2(price - cost - tax);
    return { ...line, unitPrice, price, cost, tax, profit, marginPct: price > 0 ? profit / price : 0 };
  });

  const sum = (key: "price" | "cost" | "tax" | "profit", section?: BudgetSection) =>
    round2(computed.filter((line) => !section || line.section === section).reduce((total, line) => total + line[key], 0));

  const price = sum("price");
  const profit = sum("profit");
  return {
    lines: computed,
    totals: {
      price,
      cost: sum("cost"),
      tax: sum("tax"),
      profit,
      marginPct: price > 0 ? profit / price : 0,
      bySection: {
        profissional: { price: sum("price", "profissional"), cost: sum("cost", "profissional") },
        custo: { price: sum("price", "custo"), cost: sum("cost", "custo") },
      },
    },
  };
}

export const SECTION_LABELS: Record<BudgetSection, string> = {
  profissional: "Profissionais e serviços",
  custo: "Custos de produção",
};

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
