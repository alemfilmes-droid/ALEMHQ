import type { Cents } from "@/features/finance/money";
import type { DealStage, MarginStatus, PayableCategory, PayableRecurrence, PaymentMethod, ProposalStatus } from "@/types";

export const RECEIVABLE_STATUSES = ["pendente", "atrasado", "recebido", "cancelado"] as const;
export const PAYABLE_STATUSES = ["pendente", "atrasado", "pago", "cancelado"] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];
export type PayableStatus = (typeof PAYABLE_STATUSES)[number];

export interface ReceivableItem {
  id: string;
  companyId: string;
  companyName: string;
  /** Logo do cliente (preenchido nas listagens que mostram o cliente). */
  companyLogoUrl?: string | null;
  projectId: string | null;
  projectName: string | null;
  description: string;
  serviceDescription: string | null;
  competenceMonth: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  amount: Cents;
  dueDate: string;
  receivedAt: string | null;
  receivedAmount: Cents | null;
  paymentMethod: PaymentMethod | null;
  invoiceNumber: string | null;
  notes: string | null;
  status: ReceivableStatus;
}

export interface PayableItem {
  id: string;
  projectId: string | null;
  projectName: string | null;
  companyId: string | null;
  payeeProfileId: string | null;
  payeeName: string | null;
  payeeLabel: string;
  category: PayableCategory;
  description: string;
  amount: Cents;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  isFixed: boolean;
  recurrence: PayableRecurrence;
  recurrenceUntil: string | null;
  recurrenceParentId: string | null;
  status: PayableStatus;
}

export interface ProfitabilityItem {
  projectId: string;
  projectName: string;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl?: string | null;
  dueDate: string | null;
  contractValue: Cents | null;
  totalReceived: Cents;
  receivablePending: Cents;
  payablesTotal: Cents;
  payablesPaid: Cents;
  plannedMargin: Cents | null;
  marginPct: number | null;
  marginStatus: MarginStatus | null;
}

export interface PeriodSummary {
  toReceive: Cents;
  received: Cents;
  overdueReceivables: { total: Cents; count: number };
  toPay: Cents;
  paid: Cents;
  expectedBalance: Cents;
}

export interface UpcomingItem {
  id: string;
  direction: "in" | "out";
  dueDate: string;
  label: string;
  counterpart: string;
  amount: Cents;
}

export interface AttentionItem extends UpcomingItem {
  daysOverdue: number;
  href: string;
}

/** Listas usadas pelos formulários (empresas, projetos, pessoas). Sem dados financeiros. */
export interface FinanceOptions {
  companies: { id: string; name: string }[];
  projects: { id: string; name: string; company_id: string | null }[];
  members: { id: string; full_name: string }[];
}

export interface MonthlySummaryItem {
  monthStart: string;
  monthEnd: string;
  totalReceived: Cents;
  totalToReceive: Cents;
  totalPaid: Cents;
  totalToPay: Cents;
  fixedCosts: Cents;
  variableCosts: Cents;
  netResult: Cents;
  overdueReceivablesCount: number;
  overduePayablesCount: number;
}

export interface ClientFinanceRow {
  companyId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  totalBilled: Cents;
  totalReceived: Cents;
  totalPending: Cents;
  totalCosts: Cents;
  marginPct: number | null;
  marginStatus: MarginStatus | null;
  projectCount: number;
}

export interface CashFlowDay {
  day: string;
  expectedInflow: Cents;
  expectedOutflow: Cents;
  netChange: Cents;
  runningBalance: Cents;
}

export interface DashboardKpis {
  billed: Cents;
  received: Cents;
  toReceive: Cents;
  fixedCosts: Cents;
  variableCosts: Cents;
  netResult: Cents;
  averageMarginPct: number | null;
  averageMarginStatus: MarginStatus | null;
  overdue: { total: Cents; count: number };
}

export interface CategoryCostItem {
  category: PayableCategory;
  fixedTotal: Cents;
  variableTotal: Cents;
}

/** Projeção comercial: negócio com proposta registrada e ainda não ganho/perdido. Nunca se mistura com recebíveis reais. */
export interface NegotiationItem {
  dealId: string;
  code: string;
  title: string;
  companyId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  stage: DealStage;
  ownerName: string;
  proposalAmount: Cents;
  proposalSentAt: string;
  proposalStatus: ProposalStatus;
  expectedCloseDate: string | null;
  probability: number;
  weightedAmount: Cents;
}

export interface NegotiationTotals {
  count: number;
  total: Cents;
  weighted: Cents;
}
