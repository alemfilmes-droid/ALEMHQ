import "server-only";
import { DEAL_LOSS_REASONS, OPEN_DEAL_STAGES } from "@/features/crm/labels";
import { dayEnd, dayStart } from "@/features/crm/period";
import type {
  AttentionDealItem,
  CommissionRuleRow,
  DashboardKpis,
  DealDetail,
  DealFilters,
  DealFormOptions,
  DealInteractionDetail,
  DealLogEntry,
  DealMeetingDetail,
  DealQualificationDetail,
  DirectorHomeSummary,
  LossReasonItem,
  MonthlyWonItem,
  MyCommissionSummary,
  OwnerPerformanceItem,
  StageConversionItem,
  WorkdayItem,
} from "@/features/crm/types";
import { sumCents, toCents } from "@/features/finance/money";
import { createClient } from "@/lib/supabase/server";
import type { Commitment, DealLossReason, DealStage, DealWithDetails } from "@/types";

const LIST_LIMIT = 500;

/** Escapa curingas do LIKE para busca por texto digitado. */
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * A RLS de `deals`/`deals_with_details` decide, linha a linha, quem vê o quê: gestão plena vê tudo,
 * o SDR vê os próprios negócios (e os que estão com ele agora). Audiovisual e financeiro nunca chegam
 * aqui (zero linhas).
 *
 * O período (Este mês, Últimos 3 meses...) vale só para as colunas Ganho/Perdido; as demais etapas
 * aparecem inteiras, sempre.
 */
export async function listDeals(filters: DealFilters): Promise<DealWithDetails[]> {
  const supabase = await createClient();
  let query = supabase.from("deals_with_details").select("*").order("stage_changed_at", { ascending: false }).limit(LIST_LIMIT);

  if (filters.stage?.length) query = query.in("stage", filters.stage);
  if (filters.goal?.length) query = query.overlaps("prospection_goals", filters.goal);
  if (filters.ownerId?.length) query = query.in("owner_id", filters.ownerId);
  if (filters.responsibleId?.length) query = query.in("responsible_id", filters.responsibleId);
  if (filters.source?.length) query = query.in("source", filters.source);
  if (filters.temperature?.length) query = query.in("temperature", filters.temperature);
  if (filters.companyId?.length) query = query.in("company_id", filters.companyId);
  if (filters.minValue != null) query = query.gte("estimated_value", filters.minValue);
  if (filters.maxValue != null) query = query.lte("estimated_value", filters.maxValue);
  if (filters.closeFrom) query = query.gte("expected_close_date", filters.closeFrom);
  if (filters.closeTo) query = query.lte("expected_close_date", filters.closeTo);
  if (filters.period?.from && filters.period.to) {
    const from = dayStart(filters.period.from);
    const to = dayEnd(filters.period.to);
    query = query.or(
      `stage.not.in.(ganho,perdido),and(stage.eq.ganho,won_at.gte.${from},won_at.lte.${to}),and(stage.eq.perdido,lost_at.gte.${from},lost_at.lte.${to})`,
    );
  }
  if (filters.search?.trim()) {
    const pattern = likePattern(filters.search.trim());
    query = query.or(`title.ilike.${pattern},company_name.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Falha ao carregar os negócios.");
  return data ?? [];
}

export async function getDealFormOptions(): Promise<DealFormOptions> {
  const supabase = await createClient();
  const [companies, contacts, members, comercial] = await Promise.all([
    supabase.from("companies").select("id, name, lifecycle").order("name"),
    supabase.from("contacts").select("id, company_id, full_name").order("full_name"),
    supabase.from("profiles").select("id, full_name, avatar_url").eq("is_active", true).neq("full_name", "").order("full_name"),
    supabase
      .from("profile_squads")
      .select("profile:profiles!inner(id, full_name, avatar_url, is_active)")
      .eq("squad", "comercial"),
  ]);

  const atendimento = (comercial.data ?? [])
    .map((row) => row.profile)
    .filter((profile) => profile.is_active && profile.full_name)
    .map((profile) => ({ id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return {
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    members: members.data ?? [],
    atendimento,
  };
}

export async function getDealDetail(id: string): Promise<DealDetail | null> {
  const supabase = await createClient();
  const [dealResult, qualificationResult, interactionsResult, meetingsResult, proposalsResult, negotiationsResult, logResult] =
    await Promise.all([
      supabase.from("deals_with_details").select("*").eq("id", id).maybeSingle(),
      supabase.from("deal_qualification").select("*").eq("deal_id", id).maybeSingle(),
      supabase
        .from("deal_interactions")
        .select(
          "id, deal_id, kind, channel, approach, body, responded, responded_to_interaction_id, stage, stage_to, author_id, occurred_at, author:profiles(id, full_name, avatar_url)",
        )
        .eq("deal_id", id)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("deal_meetings")
        .select(
          "id, deal_id, scheduled_at, duration_minutes, attendee_id, attendee:profiles!deal_meetings_attendee_id_fkey(id, full_name, avatar_url), location_or_link, result, result_note, result_registered_at",
        )
        .eq("deal_id", id)
        .order("scheduled_at", { ascending: false }),
      // Valores só chegam para quem tem acesso ao financeiro (as RPCs conferem no banco).
      supabase.rpc("deal_proposals_list", { p_deal_id: id }),
      supabase.rpc("deal_negotiations_list", { p_deal_id: id }),
      supabase
        .from("deal_activities")
        .select("id, body, occurred_at, author:profiles(full_name)")
        .eq("deal_id", id)
        .order("occurred_at", { ascending: false })
        .limit(30),
    ]);

  if (!dealResult.data) return null;

  const interactions: DealInteractionDetail[] = (interactionsResult.data ?? []).map((row) => ({
    id: row.id,
    deal_id: row.deal_id,
    kind: row.kind,
    channel: row.channel,
    approach: row.approach,
    body: row.body,
    responded: row.responded,
    responded_to_interaction_id: row.responded_to_interaction_id,
    stage: row.stage,
    stage_to: row.stage_to,
    author_id: row.author_id,
    author: row.author,
    occurred_at: row.occurred_at,
  }));

  const meetings: DealMeetingDetail[] = (meetingsResult.data ?? []).map((row) => ({
    id: row.id,
    deal_id: row.deal_id,
    scheduled_at: row.scheduled_at,
    duration_minutes: row.duration_minutes,
    attendee_id: row.attendee_id,
    attendee: row.attendee,
    location_or_link: row.location_or_link,
    result: row.result,
    result_note: row.result_note,
    result_registered_at: row.result_registered_at,
  }));

  const log: DealLogEntry[] = (logResult.data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    occurred_at: row.occurred_at,
    author_name: row.author?.full_name ?? null,
  }));

  const qualification: DealQualificationDetail | null = qualificationResult.data ?? null;

  return {
    deal: dealResult.data,
    qualification,
    interactions,
    meetings,
    proposals: proposalsResult.data ?? [],
    negotiations: negotiationsResult.data ?? [],
    log,
  };
}

/** Feed cronológico de interações (aba "Atividades"), filtrável por SDR dono do negócio e tipo. */
export async function listInteractionsFeed(filters: { ownerId?: string[]; kind?: string[] } = {}): Promise<
  (DealInteractionDetail & { deal_title: string; deal_code: string | null; company_name: string })[]
> {
  const supabase = await createClient();
  // Embeda pela FK de verdade (deal_interactions.deal_id → deals): a view não carrega FK.
  let query = supabase
    .from("deal_interactions")
    .select(
      "id, deal_id, kind, channel, approach, body, responded, responded_to_interaction_id, stage, stage_to, author_id, occurred_at, author:profiles(id, full_name, avatar_url), deal:deals!inner(title, code, owner_id, company:companies(name))",
    )
    .order("occurred_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (filters.kind?.length) query = query.in("kind", filters.kind as never[]);
  if (filters.ownerId?.length) query = query.in("deal.owner_id", filters.ownerId);

  const { data, error } = await query;
  if (error) throw new Error("Falha ao carregar as atividades.");
  return (data ?? []).map((row) => ({
    id: row.id,
    deal_id: row.deal_id,
    kind: row.kind,
    channel: row.channel,
    approach: row.approach,
    body: row.body,
    responded: row.responded,
    responded_to_interaction_id: row.responded_to_interaction_id,
    stage: row.stage,
    stage_to: row.stage_to,
    author_id: row.author_id,
    author: row.author,
    occurred_at: row.occurred_at,
    deal_title: row.deal?.title ?? "—",
    deal_code: row.deal?.code ?? null,
    company_name: row.deal?.company?.name ?? "—",
  }));
}

/** Negócios de uma empresa (aba "Comercial" da página de cliente) — histórico completo, ganhos e perdidos. */
export async function listDealsByCompany(companyId: string): Promise<DealWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals_with_details")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Falha ao carregar os negócios desta empresa.");
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  from: string;
  to: string;
}

export async function getDashboardKpis(period: DashboardFilters): Promise<DashboardKpis> {
  const supabase = await createClient();
  const [openResult, meetingsResult, wonResult, lostResult] = await Promise.all([
    supabase.from("deals_with_details").select("estimated_value, latest_proposal_amount, stage").in("stage", [...OPEN_DEAL_STAGES]),
    supabase.from("deal_meetings").select("id").gte("scheduled_at", period.from).lte("scheduled_at", period.to),
    supabase
      .from("deals_with_details")
      .select("estimated_value")
      .eq("stage", "ganho")
      .gte("won_at", period.from)
      .lte("won_at", period.to),
    supabase.from("deals_with_details").select("id").eq("stage", "perdido").gte("lost_at", period.from).lte("lost_at", period.to),
  ]);
  if (openResult.error || meetingsResult.error || wonResult.error || lostResult.error) {
    throw new Error("Falha ao carregar os indicadores do CRM.");
  }

  // "Em negociação": tudo que já tem proposta registrada e ainda não fechou, mesmo antes da etapa Negociação.
  const valueInNegotiation = sumCents(
    (openResult.data ?? []).filter((row) => row.latest_proposal_amount != null).map((row) => toCents(row.latest_proposal_amount)),
  );
  const wonCount = wonResult.data?.length ?? 0;
  const lostCount = lostResult.data?.length ?? 0;
  const wonValue = sumCents((wonResult.data ?? []).map((row) => toCents(row.estimated_value)));

  return {
    openDeals: openResult.data?.length ?? 0,
    valueInNegotiation,
    meetingsInPeriod: meetingsResult.data?.length ?? 0,
    wonInPeriod: wonCount,
    lostInPeriod: lostCount,
    averageTicket: wonCount > 0 ? Math.round(wonValue / wonCount) : 0,
    conversionRate: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 1000) / 10 : null,
  };
}

/** Negócios por etapa (funil) e tempo médio na etapa atual — para o gráfico do painel. */
export async function getStageConversion(): Promise<StageConversionItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("deals_with_details").select("stage, days_in_stage");
  if (error) throw new Error("Falha ao carregar a conversão por etapa.");

  const grouped = new Map<DealStage, { count: number; totalDays: number }>();
  for (const row of data ?? []) {
    if (!row.stage) continue;
    const entry = grouped.get(row.stage) ?? { count: 0, totalDays: 0 };
    entry.count += 1;
    entry.totalDays += row.days_in_stage ?? 0;
    grouped.set(row.stage, entry);
  }
  return Array.from(grouped.entries()).map(([stage, entry]) => ({
    stage,
    count: entry.count,
    averageDaysInStage: entry.count > 0 ? Math.round((entry.totalDays / entry.count) * 10) / 10 : null,
  }));
}

export async function getLossReasons(period: DashboardFilters): Promise<LossReasonItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals_with_details")
    .select("lost_reason")
    .eq("stage", "perdido")
    .gte("lost_at", period.from)
    .lte("lost_at", period.to);
  if (error) throw new Error("Falha ao carregar os motivos de perda.");

  const counts = new Map<DealLossReason, number>();
  for (const row of data ?? []) {
    if (!row.lost_reason) continue;
    counts.set(row.lost_reason, (counts.get(row.lost_reason) ?? 0) + 1);
  }
  return DEAL_LOSS_REASONS.map((reason) => ({ reason, count: counts.get(reason) ?? 0 })).filter((item) => item.count > 0);
}

/** Valor ganho por mês, últimos 12 meses — para o gráfico de linha do painel. */
export async function getMonthlyWonValue(): Promise<MonthlyWonItem[]> {
  const supabase = await createClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
  twelveMonthsAgo.setUTCDate(1);

  const { data, error } = await supabase
    .from("deals_with_details")
    .select("won_at, estimated_value")
    .eq("stage", "ganho")
    .gte("won_at", twelveMonthsAgo.toISOString());
  if (error) throw new Error("Falha ao carregar o valor ganho por mês.");

  const months: MonthlyWonItem[] = [];
  const cursor = new Date(twelveMonthsAgo);
  for (let i = 0; i < 12; i++) {
    months.push({ monthStart: cursor.toISOString().slice(0, 10), totalValue: 0, count: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const row of data ?? []) {
    if (!row.won_at) continue;
    const monthKey = `${row.won_at.slice(0, 7)}-01`;
    const bucket = months.find((month) => month.monthStart === monthKey);
    if (bucket) {
      bucket.totalValue += toCents(row.estimated_value);
      bucket.count += 1;
    }
  }
  return months;
}

/** Comparativo por SDR (dono do lead): negócios abertos, reuniões, ganhos e taxa de conversão. */
export async function getOwnerPerformance(period: DashboardFilters): Promise<OwnerPerformanceItem[]> {
  const supabase = await createClient();
  const [deals, meetings] = await Promise.all([
    supabase.from("deals_with_details").select("owner_id, owner_name, stage, won_at, lost_at"),
    // Embeda pela FK de verdade (deal_meetings.deal_id → deals) — a view não carrega FK.
    supabase
      .from("deal_meetings")
      .select("deal:deals!inner(owner_id)")
      .gte("scheduled_at", period.from)
      .lte("scheduled_at", period.to),
  ]);
  if (deals.error || meetings.error) throw new Error("Falha ao carregar o comparativo por responsável.");

  const byOwner = new Map<string, OwnerPerformanceItem>();
  const ensure = (ownerId: string, ownerName: string) => {
    const existing = byOwner.get(ownerId);
    if (existing) return existing;
    const created: OwnerPerformanceItem = { ownerId, ownerName, openDeals: 0, meetings: 0, won: 0, lost: 0, conversionRate: null };
    byOwner.set(ownerId, created);
    return created;
  };

  const openStages: readonly DealStage[] = OPEN_DEAL_STAGES;
  for (const row of deals.data ?? []) {
    if (!row.owner_id) continue;
    const entry = ensure(row.owner_id, row.owner_name ?? "—");
    if (row.stage && openStages.includes(row.stage)) entry.openDeals += 1;
    if (row.stage === "ganho" && row.won_at && row.won_at >= period.from && row.won_at <= period.to) entry.won += 1;
    if (row.stage === "perdido" && row.lost_at && row.lost_at >= period.from && row.lost_at <= period.to) entry.lost += 1;
  }
  for (const row of meetings.data ?? []) {
    const ownerId = row.deal?.owner_id;
    if (!ownerId) continue;
    const entry = byOwner.get(ownerId);
    if (entry) entry.meetings += 1;
  }
  for (const entry of byOwner.values()) {
    const decided = entry.won + entry.lost;
    entry.conversionRate = decided > 0 ? Math.round((entry.won / decided) * 1000) / 10 : null;
  }

  return Array.from(byOwner.values()).sort((a, b) => b.won - a.won);
}

/** Negócios abertos com temperatura fora de "em dia", ou leads frios prontos para reaquecer — para o painel. */
export async function listDealsNeedingAttention(limit = 20): Promise<AttentionDealItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals_needing_attention")
    .select("id, title, company_name, next_action_at, temperature_reason, can_reheat")
    .order("next_action_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error("Falha ao carregar os negócios que precisam de atenção.");

  return (data ?? []).map((row) => ({
    id: row.id!,
    title: row.title!,
    companyName: row.company_name!,
    reason: row.can_reheat ? "Lead frio pronto para reaquecer" : (row.temperature_reason ?? "Precisa de atenção"),
    nextActionAt: row.next_action_at,
  }));
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

function monthStartISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date()).split("-");
  return `${parts[0]}-${parts[1]}-01T00:00:00-03:00`;
}

/**
 * "Meu dia comercial": o que está com a pessoa agora, na ordem de prioridade — ações vencidas, ações de
 * hoje, prospecções paradas, negócios sem atualização, leads frios para reaquecer, e o que voltou de reunião.
 */
export async function getWorkday(profileId: string): Promise<WorkdayItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals_with_details")
    .select(
      "id, title, company_name, stage, owner_id, responsible_id, next_action, next_action_overdue, next_action_today, stale_prospection, needs_update, can_reheat, returned_from_meeting, temperature_reason",
    )
    .or(`responsible_id.eq.${profileId},and(owner_id.eq.${profileId},stage.eq.perdido)`)
    .limit(200);
  if (error) throw new Error("Falha ao carregar o seu dia comercial.");

  const order: WorkdayItem["category"][] = ["acao_vencida", "acao_hoje", "prospeccao_parada", "sem_atualizacao", "reaquecer", "voltou_reuniao"];
  const items: WorkdayItem[] = [];

  for (const row of data ?? []) {
    if (!row.id || !row.title) continue;
    let category: WorkdayItem["category"] | null = null;
    let reason = "";
    if (row.next_action_overdue) {
      category = "acao_vencida";
      reason = `Ação vencida: ${row.next_action ?? "sem descrição"}`;
    } else if (row.next_action_today) {
      category = "acao_hoje";
      reason = `Hoje: ${row.next_action ?? "sem descrição"}`;
    } else if (row.stale_prospection) {
      category = "prospeccao_parada";
      reason = "Sem contato há mais de 48h";
    } else if (row.needs_update) {
      category = "sem_atualizacao";
      reason = "Sem atualização há mais de 24h";
    } else if (row.can_reheat && row.owner_id === profileId) {
      category = "reaquecer";
      reason = "Lead frio há 45 dias — decidir reaquecimento";
    } else if (row.returned_from_meeting) {
      category = "voltou_reuniao";
      reason = "Voltou de reunião para você";
    }
    if (category) items.push({ dealId: row.id, title: row.title, companyName: row.company_name ?? "—", reason, category });
  }

  return items.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/** Comissões do SDR: potencial (negócios abertos com valor) e confirmada (ganhos no mês). */
export async function getMyCommissions(profileId: string): Promise<MyCommissionSummary> {
  const supabase = await createClient();
  const [openResult, wonResult] = await Promise.all([
    supabase
      .from("deals_with_details")
      .select("commission_amount")
      .eq("owner_id", profileId)
      .in("stage", [...OPEN_DEAL_STAGES])
      .not("commission_amount", "is", null),
    supabase
      .from("deals_with_details")
      .select("commission_amount")
      .eq("owner_id", profileId)
      .eq("stage", "ganho")
      .gte("won_at", monthStartISO())
      .not("commission_amount", "is", null),
  ]);
  if (openResult.error || wonResult.error) throw new Error("Falha ao carregar as comissões.");

  return {
    potential: sumCents((openResult.data ?? []).map((row) => toCents(row.commission_amount))),
    potentialCount: openResult.data?.length ?? 0,
    confirmedMonth: sumCents((wonResult.data ?? []).map((row) => toCents(row.commission_amount))),
    confirmedCount: wonResult.data?.length ?? 0,
  };
}

/** Visão gerencial (diretoria/master): valor em negociação, propostas aguardando, reuniões de hoje, ganhos do mês. */
export async function getDirectorHomeSummary(): Promise<DirectorHomeSummary> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [proposals, meetingsToday, won] = await Promise.all([
    supabase
      .from("deals_with_details")
      .select("latest_proposal_amount, latest_proposal_status")
      .in("stage", [...OPEN_DEAL_STAGES])
      .not("latest_proposal_amount", "is", null),
    supabase
      .from("deal_meetings")
      .select("id")
      .is("result", null)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString()),
    supabase.from("deals_with_details").select("estimated_value").eq("stage", "ganho").gte("won_at", monthStartISO()),
  ]);
  if (proposals.error || meetingsToday.error || won.error) throw new Error("Falha ao carregar o resumo do comercial.");

  return {
    valueInNegotiation: sumCents((proposals.data ?? []).map((row) => toCents(row.latest_proposal_amount))),
    proposalsAwaiting: (proposals.data ?? []).filter((row) => row.latest_proposal_status === "enviada").length,
    meetingsToday: meetingsToday.data?.length ?? 0,
    wonMonthCount: won.data?.length ?? 0,
    wonMonthValue: sumCents((won.data ?? []).map((row) => toCents(row.estimated_value))),
  };
}

/** Próximos compromissos da agenda interna (commitments) da pessoa. */
export async function listMyCommitments(profileId: string, limit = 8): Promise<Commitment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    // Dono ou participante (attendees) — a RLS de commitments já limita ao que a pessoa pode ver.
    .or(`owner_id.eq.${profileId},attendees.cs.{${profileId}}`)
    .eq("status", "agendado")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);
  if (error) throw new Error("Falha ao carregar os compromissos.");
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Configurações (comissão)
// ---------------------------------------------------------------------------

export async function listCommissionRules(): Promise<CommissionRuleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commission_rules").select("id, kind, percent, effective_from").order("effective_from", { ascending: false });
  if (error) throw new Error("Falha ao carregar as regras de comissão.");
  const seen = new Set<string>();
  const current: CommissionRuleRow[] = [];
  for (const row of data ?? []) {
    if (new Date(row.effective_from).getTime() > Date.now() || seen.has(row.kind)) continue;
    seen.add(row.kind);
    current.push(row);
  }
  return current;
}
