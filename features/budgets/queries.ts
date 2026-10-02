import "server-only";
import { parsePresentation, parseProposalProfile, type BudgetRecord, type BudgetStatus, type CatalogItem, type ProposalProfile } from "@/features/budgets/types";
import { computeBudget, type BudgetLineInput } from "@/features/budgets/pricing";
import { createClient } from "@/lib/supabase/server";

export interface BudgetListItem {
  id: string;
  number: number;
  version: number;
  clientName: string;
  title: string;
  projectName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  issueDate: string;
  validUntil: string;
  sentAt: string | null;
  decidedAt: string | null;
  statusNote: string | null;
  status: BudgetStatus;
  total: number;
  marginPct: number;
}

type ItemRow = { id: string; section: "profissional" | "custo"; description: string; unit: string; quantity: number | string; unit_cost: number | string; unit_price_override: number | string | null; position?: number };

function toLines(items: ItemRow[]): BudgetLineInput[] {
  return items.map((item) => ({
    id: item.id,
    section: item.section,
    description: item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
    unitCost: Number(item.unit_cost),
    unitPriceOverride: item.unit_price_override === null ? null : Number(item.unit_price_override),
  }));
}

export async function listBudgets(): Promise<BudgetListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budgets")
    .select(
      "id, number, version, client_name, title, issue_date, valid_until, sent_at, decided_at, status_note, status, fee_pct, tax_pct, deal_id, project:projects(name), deal:deals(title), items:budget_items(id, section, description, unit, quantity, unit_cost, unit_price_override)",
    )
    .order("number", { ascending: false })
    .order("version", { ascending: false })
    .limit(300);
  return (data ?? []).map((row) => {
    const { totals } = computeBudget(toLines(row.items), Number(row.fee_pct), Number(row.tax_pct));
    return {
      id: row.id,
      number: row.number,
      version: row.version,
      clientName: row.client_name,
      title: row.title,
      projectName: row.project?.name ?? null,
      dealId: row.deal_id,
      dealTitle: row.deal?.title ?? null,
      issueDate: row.issue_date,
      validUntil: row.valid_until,
      sentAt: row.sent_at,
      decidedAt: row.decided_at,
      statusNote: row.status_note,
      status: row.status,
      total: totals.final,
      marginPct: totals.marginPct,
    };
  });
}

export async function getBudget(id: string): Promise<BudgetRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budgets")
    .select(
      "*, company:companies(logo_url), project:projects(name), deal:deals(title), items:budget_items(id, section, description, unit, quantity, unit_cost, unit_price_override, position)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const sorted = [...data.items].sort((a, b) => (a.section === b.section ? a.position - b.position : a.section === "profissional" ? -1 : 1));
  return {
    id: data.id,
    number: data.number,
    version: data.version,
    parentId: data.parent_id,
    projectId: data.project_id,
    projectName: data.project?.name ?? null,
    dealId: data.deal_id,
    dealTitle: data.deal?.title ?? null,
    deliverables: data.deliverables,
    sentAt: data.sent_at,
    decidedAt: data.decided_at,
    statusNote: data.status_note ?? "",
    companyId: data.company_id,
    companyLogoUrl: data.company?.logo_url ?? null,
    clientName: data.client_name,
    title: data.title,
    issueDate: data.issue_date,
    validUntil: data.valid_until,
    feePct: Number(data.fee_pct),
    taxPct: Number(data.tax_pct),
    status: data.status,
    paymentTerms: data.payment_terms ?? "",
    notes: data.notes ?? "",
    presentation: parsePresentation(data.presentation),
    items: toLines(sorted),
  };
}

export async function listCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budget_catalog_items")
    .select("id, section, name, unit, default_cost, active, position")
    .order("section")
    .order("position")
    .order("name");
  return (data ?? []).map((row) => ({
    id: row.id,
    position: row.position,
    section: row.section,
    name: row.name,
    unit: row.unit,
    defaultCost: Number(row.default_cost),
    active: row.active,
  }));
}

export async function getProposalProfile(): Promise<ProposalProfile> {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("proposal_profile").eq("id", true).maybeSingle();
  return parseProposalProfile(data?.proposal_profile);
}

/** Projetos do cliente (para vincular o orçamento) e negócios abertos dele no CRM. */
export async function getClientLinks(companyId: string | null) {
  if (!companyId) return { projects: [], deals: [] };
  const supabase = await createClient();
  const [projects, deals] = await Promise.all([
    supabase.from("projects").select("id, name").eq("company_id", companyId).order("created_at", { ascending: false }),
    supabase.from("deals").select("id, title, stage").eq("company_id", companyId).not("stage", "in", "(ganho,perdido)").order("created_at", { ascending: false }),
  ]);
  return { projects: projects.data ?? [], deals: deals.data ?? [] };
}
