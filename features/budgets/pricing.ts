/**
 * Conta do orçamento (mesma regra na tela, na nota, na apresentação e no banco — ver
 * budget_final_total()).
 *
 * Valor do serviço por item = custo × (1 + FEE%), salvo quando o item tem preço fixado à mão.
 * Imposto = valor do serviço × imposto% (aparece para o cliente). Valor final = serviço + imposto.
 * Ganho da empresa = serviço − custo (o imposto é repassado).
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
  /** Valor unitário do serviço (sem imposto). */
  unitPrice: number;
  price: number;
  cost: number;
  profit: number;
  marginPct: number;
}

export interface BudgetTotals {
  /** Soma do valor dos serviços (sem imposto). */
  services: number;
  tax: number;
  /** Valor final para pagamento (serviços + imposto). */
  final: number;
  cost: number;
  profit: number;
  marginPct: number;
  bySection: Record<BudgetSection, { price: number; cost: number }>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeBudget(lines: BudgetLineInput[], feePct: number, taxPct: number): { lines: BudgetLine[]; totals: BudgetTotals } {
  const factor = 1 + Math.max(feePct, 0) / 100;
  const computed = lines.map((line) => {
    const unitPrice = line.unitPriceOverride ?? round2(line.unitCost * factor);
    const price = round2(unitPrice * line.quantity);
    const cost = round2(line.unitCost * line.quantity);
    const profit = round2(price - cost);
    return { ...line, unitPrice, price, cost, profit, marginPct: price > 0 ? profit / price : 0 };
  });

  const sum = (key: "price" | "cost" | "profit", section?: BudgetSection) =>
    round2(computed.filter((line) => !section || line.section === section).reduce((total, line) => total + line[key], 0));

  const services = sum("price");
  const tax = round2(services * (Math.max(taxPct, 0) / 100));
  const profit = sum("profit");
  return {
    lines: computed,
    totals: {
      services,
      tax,
      final: round2(services + tax),
      cost: sum("cost"),
      profit,
      marginPct: services > 0 ? profit / services : 0,
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

export function pctNumber(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
