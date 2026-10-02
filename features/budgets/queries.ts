import "server-only";
import { parsePresentation, parseProposalProfile, type BudgetRecord, type BudgetStatus, type CatalogItem, type ProposalProfile } from "@/features/budgets/types";
import { computeBudget } from "@/features/budgets/pricing";
import { createClient } from "@/lib/supabase/server";

export interface BudgetListItem {
  id: string;
  number: number;
  clientName: string;
  title: string;
  issueDate: string;
  validUntil: string;
  status: BudgetStatus;
  total: number;
  marginPct: number;
}

export async function listBudgets(): Promise<BudgetListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budgets")
    .select("id, number, client_name, title, issue_date, valid_until, status, fee_pct, tax_pct, items:budget_items(id, section, description, unit, quantity, unit_cost, unit_price_override)")
    .order("number", { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => {
    const { totals } = computeBudget(
      row.items.map((item) => ({
        id: item.id,
        section: item.section,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitCost: Number(item.unit_cost),
        unitPriceOverride: item.unit_price_override === null ? null : Number(item.unit_price_override),
      })),
      Number(row.fee_pct),
      Number(row.tax_pct),
    );
    return {
      id: row.id,
      number: row.number,
      clientName: row.client_name,
      title: row.title,
      issueDate: row.issue_date,
      validUntil: row.valid_until,
      status: row.status,
      total: totals.price,
      marginPct: totals.marginPct,
    };
  });
}

export async function getBudget(id: string): Promise<BudgetRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budgets")
    .select("*, company:companies(logo_url), items:budget_items(id, section, description, unit, quantity, unit_cost, unit_price_override, position)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    number: data.number,
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
    items: [...data.items]
      .sort((a, b) => (a.section === b.section ? a.position - b.position : a.section === "profissional" ? -1 : 1))
      .map((item) => ({
        id: item.id,
        section: item.section,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitCost: Number(item.unit_cost),
        unitPriceOverride: item.unit_price_override === null ? null : Number(item.unit_price_override),
      })),
  };
}

export async function listCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("budget_catalog_items").select("id, section, name, unit, default_cost, active").order("section").order("name");
  return (data ?? []).map((row) => ({ id: row.id, section: row.section, name: row.name, unit: row.unit, defaultCost: Number(row.default_cost), active: row.active }));
}

export async function getProposalProfile(): Promise<ProposalProfile> {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("proposal_profile").eq("id", true).maybeSingle();
  return parseProposalProfile(data?.proposal_profile);
}
