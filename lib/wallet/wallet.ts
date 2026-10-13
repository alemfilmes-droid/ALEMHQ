import { nextPayday } from "@/lib/wallet/payout-date";

/**
 * Carteira: visão SÓ DE LEITURA dos pagamentos do Financeiro em que a pessoa é a favorecida (fonte única). Aqui
 * só se organiza o que veio do banco: o tipo de cada linha, os grupos por data de pagamento, o próximo pagamento
 * e a linha do fixo (calculada, sem gravar nada) até o financeiro lançar o pagamento de verdade.
 */

export const REMUNERATION_TYPES = ["fixo", "fixo_mais_variavel", "so_comissao", "por_job"] as const;
export type RemunerationType = (typeof REMUNERATION_TYPES)[number];

export const REMUNERATION_TYPE_LABELS: Record<RemunerationType, string> = {
  fixo: "Fixo",
  fixo_mais_variavel: "Fixo + variável",
  so_comissao: "Só comissão",
  por_job: "Por job",
};

export const WALLET_KINDS = ["salario_fixo", "pro_labore", "comissao", "bonus_meta", "cache_job", "outro"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

export const WALLET_KIND_LABELS: Record<WalletKind, string> = {
  salario_fixo: "Fixo",
  pro_labore: "Pró-labore",
  comissao: "Comissão",
  bonus_meta: "Bônus de meta",
  cache_job: "Cachê (job)",
  outro: "Outro",
};

export interface Remuneration {
  type: RemunerationType;
  fixedAmountCents: number | null;
  payday: number;
  defaultCommissionPercent: number | null;
}

/** Linha do Financeiro (pagamento) como a Carteira recebe — valores em centavos, datas só com dia. */
export interface WalletEntry {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
  /** Data em que cai na Carteira (dia de pagamento da pessoa); sem dia configurado, o vencimento. */
  payoutDate: string;
  paidAt: string | null;
  companyName: string | null;
  projectName: string | null;
  goalTitle: string | null;
  teamType: "pro_labore" | "comissao" | "pagamento_colaborador" | null;
  category: string;
  isFixed: boolean;
  hasGoal: boolean;
  hasProject: boolean;
  /** Quando foi lançado no Financeiro. */
  createdAt: string | null;
}

export interface WalletLine extends Omit<WalletEntry, "teamType" | "isFixed" | "hasGoal" | "hasProject"> {
  kind: WalletKind;
  /** Linha do fixo calculada (ainda não lançada no Financeiro). */
  virtual: boolean;
}

export interface WalletGroup {
  date: string;
  totalCents: number;
  lines: WalletLine[];
}

export interface WalletView {
  next: { date: string; totalCents: number } | null;
  toReceive: WalletGroup[];
  paid: WalletLine[];
}

export function walletKindOf(entry: Pick<WalletEntry, "teamType" | "category" | "isFixed" | "hasGoal" | "hasProject">): WalletKind {
  if (entry.teamType === "comissao" || entry.category === "comissao") return entry.hasGoal ? "bonus_meta" : "comissao";
  if (entry.teamType === "pro_labore" || entry.category === "pro_labore") return "pro_labore";
  if (entry.isFixed) return "salario_fixo";
  if (entry.hasProject || entry.category === "freelancer") return "cache_job";
  return "outro";
}

function toLine(entry: WalletEntry): WalletLine {
  return {
    id: entry.id,
    description: entry.description,
    amountCents: entry.amountCents,
    dueDate: entry.dueDate,
    payoutDate: entry.payoutDate,
    paidAt: entry.paidAt,
    companyName: entry.companyName,
    projectName: entry.projectName,
    goalTitle: entry.goalTitle,
    category: entry.category,
    createdAt: entry.createdAt,
    kind: walletKindOf(entry),
    virtual: false,
  };
}

const FIXED_KINDS: readonly WalletKind[] = ["salario_fixo", "pro_labore"];

export function buildWallet(entries: readonly WalletEntry[], remuneration: Remuneration | null, today: string): WalletView {
  const lines = entries.map(toLine);
  const pending = lines.filter((line) => line.paidAt === null);
  const paid = lines.filter((line) => line.paidAt !== null).sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));

  // O fixo aparece sozinho no próximo dia de pagamento, até existir o lançamento de verdade nesse dia.
  if (remuneration && (remuneration.fixedAmountCents ?? 0) > 0 && (remuneration.type === "fixo" || remuneration.type === "fixo_mais_variavel")) {
    const date = nextPayday(today, remuneration.payday);
    const alreadyThere = lines.some((line) => FIXED_KINDS.includes(line.kind) && line.payoutDate === date);
    if (!alreadyThere) {
      pending.push({
        id: `fixo-${date}`,
        description: "Fixo do mês",
        amountCents: remuneration.fixedAmountCents ?? 0,
        dueDate: date,
        payoutDate: date,
        paidAt: null,
        companyName: null,
        projectName: null,
        goalTitle: null,
        category: "pessoal",
        createdAt: null,
        kind: "salario_fixo",
        virtual: true,
      });
    }
  }

  const byDate = new Map<string, WalletLine[]>();
  for (const line of pending) byDate.set(line.payoutDate, [...(byDate.get(line.payoutDate) ?? []), line]);
  const toReceive = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, group]) => ({ date, lines: group, totalCents: group.reduce((sum, line) => sum + line.amountCents, 0) }));
  const upcoming = toReceive.find((group) => group.date >= today) ?? toReceive[0] ?? null;

  return { next: upcoming ? { date: upcoming.date, totalCents: upcoming.totalCents } : null, toReceive, paid };
}

/** Pagos de um mês (yyyy-mm) — filtro do histórico. */
export function paidInMonth(paid: readonly WalletLine[], month: string): WalletLine[] {
  return paid.filter((line) => (line.paidAt ?? "").startsWith(month));
}
