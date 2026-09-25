import type { Database } from "@/types/database";

export type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type Invitation = Tables["invitations"]["Row"];
export type Company = Tables["companies"]["Row"];
export type Contact = Tables["contacts"]["Row"];
export type Project = Tables["projects"]["Row"];
export type ProjectFinancials = Tables["project_financials"]["Row"];
export type CompanyLifecycle = Database["public"]["Enums"]["company_lifecycle"];
export type CompanySource = Database["public"]["Enums"]["company_source"];
export type ProjectStage = Database["public"]["Enums"]["project_stage"];
export type AccessRole = Database["public"]["Enums"]["access_role"];
export type ProductionFunction = Database["public"]["Enums"]["production_function"];
export type InvitationStatus = Database["public"]["Enums"]["invitation_status"];

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PayableCategory = Database["public"]["Enums"]["payable_category"];
export type PayableRecurrence = Database["public"]["Enums"]["payable_recurrence"];

export type Squad = Database["public"]["Enums"]["squad"];
export type ProfileSquad = Tables["profile_squads"]["Row"];
export type OrgLevel = Database["public"]["Enums"]["org_level"];
export type ClientHealth = Database["public"]["Enums"]["client_health"];
export type ClientTier = Database["public"]["Enums"]["client_tier"];
export type ProjectModel = Database["public"]["Enums"]["project_model"];
export type ProjectPriority = Database["public"]["Enums"]["project_priority"];
export type ServiceType = Database["public"]["Enums"]["service_type"];
export type ProjectMember = Tables["project_members"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type ProjectProfitabilityRow = Database["public"]["Views"]["project_profitability"]["Row"];
export type MarginStatus = "saudavel" | "atencao" | "critico";

/** Profile com os squads já resolvidos — o que `getCurrentProfile()` retorna. */
export type ProfileWithSquads = Profile & { squads: Squad[]; leadSquads: Squad[] };

export type Pauta = Tables["pautas"]["Row"];
export type PautaWithDetails = Database["public"]["Views"]["pautas_with_details"]["Row"];
export type PautaMember = Tables["pauta_members"]["Row"];
export type PautaComment = Tables["pauta_comments"]["Row"];
export type PautaStatusHistory = Tables["pauta_status_history"]["Row"];
export type PautaColumn = Database["public"]["Enums"]["pauta_column"];
export type PautaStatus = Database["public"]["Enums"]["pauta_status"];
export type PautaCaptureType = Database["public"]["Enums"]["pauta_capture_type"];

export type TimeEntry = Tables["time_entries"]["Row"];
export type WorkSchedule = Tables["work_schedules"]["Row"];
export type TimeEntryKind = Database["public"]["Enums"]["time_entry_kind"];
export type TimeEntrySource = Database["public"]["Enums"]["time_entry_source"];
export type TimeDailySummaryRow = Database["public"]["Views"]["time_daily_summary"]["Row"];
export type TimeBalanceSummaryRow = Database["public"]["Views"]["time_balance_summary"]["Row"];

export type Deal = Tables["deals"]["Row"];
export type DealWithDetails = Database["public"]["Views"]["deals_with_details"]["Row"];
export type DealQualification = Tables["deal_qualification"]["Row"];
export type DealActivity = Tables["deal_activities"]["Row"];
export type DealMeeting = Tables["deal_meetings"]["Row"];
export type DealInteraction = Tables["deal_interactions"]["Row"];
export type DealProposal = Tables["deal_proposals"]["Row"];
export type DealNegotiation = Tables["deal_negotiations"]["Row"];
export type Commitment = Tables["commitments"]["Row"];
export type CommissionRule = Tables["commission_rules"]["Row"];
export type DealStageProbability = Tables["deal_stage_probabilities"]["Row"];
export type DealStage = Database["public"]["Enums"]["deal_stage"];
export type DealLossReason = Database["public"]["Enums"]["deal_loss_reason"];
export type ActivityKind = Database["public"]["Enums"]["activity_kind"];
export type MeetingOutcome = Database["public"]["Enums"]["meeting_outcome"];
export type ProspectionGoal = Database["public"]["Enums"]["prospection_goal"];
export type DealInteractionKind = Database["public"]["Enums"]["deal_interaction_kind"];
export type DealInteractionChannel = Database["public"]["Enums"]["deal_interaction_channel"];
export type ProposalChannel = Database["public"]["Enums"]["proposal_channel"];
export type ProposalStatus = Database["public"]["Enums"]["proposal_status"];
export type CommitmentKind = Database["public"]["Enums"]["commitment_kind"];
export type CommitmentStatus = Database["public"]["Enums"]["commitment_status"];
export type ReheatStatus = Database["public"]["Enums"]["reheat_status"];
export type DirectionTask = Database["public"]["Enums"]["direction_task"];
export type CommissionKind = Database["public"]["Enums"]["commission_kind"];
export type DealNeedingAttention = Database["public"]["Views"]["deals_needing_attention"]["Row"];
export type CommitmentVisibility = Database["public"]["Enums"]["commitment_visibility"];
export type GoogleSyncStatus = Database["public"]["Enums"]["google_sync_status"];
export type AgendaFeedRow = Database["public"]["Functions"]["agenda_feed"]["Returns"][number];
