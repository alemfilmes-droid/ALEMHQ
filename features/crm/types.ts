import type { Temperature } from "@/features/crm/labels";
import type { BoardPeriod } from "@/features/crm/period";
import type { Cents } from "@/features/finance/money";
import type {
  CompanySource,
  Commitment,
  DealInteractionChannel,
  DealInteractionKind,
  DealLossReason,
  DealNegotiation,
  DealProposal,
  DealStage,
  DealWithDetails,
  MeetingOutcome,
  ProspectionGoal,
} from "@/types";

export interface DealFilters {
  stage?: DealStage[];
  goal?: ProspectionGoal[];
  /** SDR dono do lead (comissão). */
  ownerId?: string[];
  /** Quem está com a bola agora. */
  responsibleId?: string[];
  source?: CompanySource[];
  temperature?: Temperature[];
  companyId?: string[];
  minValue?: number;
  maxValue?: number;
  closeFrom?: string;
  closeTo?: string;
  /** Aplica-se só às colunas Ganho/Perdido; as demais mostram tudo. */
  period?: BoardPeriod;
  search?: string;
}

export interface DealOptionMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface DealOptionCompany {
  id: string;
  name: string;
  lifecycle: string;
}

export interface DealOptionContact {
  id: string;
  company_id: string;
  full_name: string;
}

/** Listas dos formulários. `atendimento` = pessoas do squad comercial (recebem o onboarding). */
export interface DealFormOptions {
  companies: DealOptionCompany[];
  contacts: DealOptionContact[];
  members: DealOptionMember[];
  atendimento: DealOptionMember[];
}

export interface DealInteractionDetail {
  id: string;
  deal_id: string;
  kind: DealInteractionKind;
  channel: DealInteractionChannel | null;
  approach: string | null;
  body: string;
  responded: boolean | null;
  responded_to_interaction_id: string | null;
  stage: DealStage;
  stage_to: DealStage | null;
  author_id: string | null;
  author: DealOptionMember | null;
  occurred_at: string;
}

export interface DealMeetingDetail {
  id: string;
  deal_id: string;
  scheduled_at: string;
  duration_minutes: number;
  attendee_id: string;
  attendee: DealOptionMember | null;
  location_or_link: string | null;
  result: MeetingOutcome | null;
  result_note: string | null;
  result_registered_at: string | null;
}

export interface DealQualificationDetail {
  deal_id: string;
  budget_range: string | null;
  project_type: string | null;
  desired_timeline: string | null;
  decision_maker_contacted: boolean | null;
  pain_point: string | null;
  notes: string | null;
  qualified_at: string | null;
  qualified_by: string | null;
}

export interface DealLogEntry {
  id: string;
  body: string;
  occurred_at: string;
  author_name: string | null;
}

export interface DealDetail {
  deal: DealWithDetails;
  qualification: DealQualificationDetail | null;
  interactions: DealInteractionDetail[];
  meetings: DealMeetingDetail[];
  proposals: DealProposal[];
  negotiations: DealNegotiation[];
  log: DealLogEntry[];
}

export interface StageColumnSummary {
  count: number;
  totalValue: Cents;
}

export interface DashboardKpis {
  openDeals: number;
  valueInNegotiation: Cents;
  meetingsInPeriod: number;
  wonInPeriod: number;
  lostInPeriod: number;
  averageTicket: Cents;
  conversionRate: number | null;
}

export interface StageConversionItem {
  stage: DealStage;
  count: number;
  averageDaysInStage: number | null;
}

export interface LossReasonItem {
  reason: DealLossReason;
  count: number;
}

export interface MonthlyWonItem {
  monthStart: string;
  totalValue: Cents;
  count: number;
}

export interface OwnerPerformanceItem {
  ownerId: string;
  ownerName: string;
  openDeals: number;
  meetings: number;
  won: number;
  lost: number;
  conversionRate: number | null;
}

export interface AttentionDealItem {
  id: string;
  title: string;
  companyName: string;
  reason: string;
  nextActionAt: string | null;
}

/** Uma linha do card "Meu dia comercial", já na ordem de prioridade. */
export interface WorkdayItem {
  dealId: string;
  title: string;
  companyName: string;
  reason: string;
  category: "acao_vencida" | "acao_hoje" | "prospeccao_parada" | "sem_atualizacao" | "reaquecer" | "voltou_reuniao";
}

export interface MyCommissionSummary {
  /** Potencial: negócios abertos com valor (proposta ou estimativa). */
  potential: Cents;
  potentialCount: number;
  /** Confirmada: ganhos no mês corrente. */
  confirmedMonth: Cents;
  confirmedCount: number;
}

export interface DirectorHomeSummary {
  valueInNegotiation: Cents;
  proposalsAwaiting: number;
  meetingsToday: number;
  wonMonthCount: number;
  wonMonthValue: Cents;
}

export type CommitmentWithDeal = Commitment;

export interface CommissionRuleRow {
  id: string;
  kind: "padrao" | "reaquecido";
  percent: number;
  effective_from: string;
}

/** Kanban do funil, agrupado pelas 10 etapas fixas. */
export type DealBoard = Record<DealStage, DealWithDetails[]>;
