"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { presentationSchema, proposalProfileSchema, type PresentationContent, type ProposalProfile } from "@/features/budgets/types";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const FORBIDDEN: ActionResult = { ok: false, error: "Só o master acessa os orçamentos." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };

async function requireMaster() {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "budgets") ? profile : null;
}

const money = z.number().min(0).max(100_000_000);

const headerSchema = z.object({
  clientName: z.string().trim().min(2, "Informe o cliente.").max(160),
  companyId: z.string().uuid().or(z.literal("")),
  title: z.string().trim().min(2, "Informe o projeto.").max(160),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  feePct: z.number().min(0).max(999),
  taxPct: z.number().min(0).max(99),
  status: z.enum(["rascunho", "enviado", "aprovado", "recusado"]),
  paymentTerms: z.string().trim().max(1000),
  notes: z.string().trim().max(2000),
});

const itemSchema = z.object({
  section: z.enum(["profissional", "custo"]),
  catalogItemId: z.string().uuid().nullable(),
  description: z.string().trim().min(1).max(160),
  unit: z.string().trim().max(30),
  quantity: z.number().positive().max(100_000),
  unitCost: money,
  unitPriceOverride: money.nullable(),
});

export type BudgetHeaderValues = z.infer<typeof headerSchema>;
export type BudgetItemValues = z.infer<typeof itemSchema>;

export async function createBudgetAction(input: { clientName: string; companyId: string; title: string }): Promise<ActionResult & { id?: string }> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const parsed = z
    .object({ clientName: z.string().trim().min(2).max(160), companyId: z.string().uuid().or(z.literal("")), title: z.string().trim().min(2).max(160) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informe o cliente e o nome do projeto." };

  const supabase = await createClient();
  // FEE e imposto começam iguais aos do último orçamento (é o padrão da casa).
  const { data: last } = await supabase.from("budgets").select("fee_pct, tax_pct, payment_terms").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      client_name: parsed.data.clientName,
      company_id: parsed.data.companyId || null,
      title: parsed.data.title,
      fee_pct: last?.fee_pct ?? 30,
      tax_pct: last?.tax_pct ?? 6,
      payment_terms: last?.payment_terms ?? "50% na aprovação e 50% na entrega.",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível criar o orçamento." };
  revalidatePath("/orcamentos");
  return { ok: true, id: data.id };
}

/** Salva o orçamento inteiro (cabeçalho + itens) de uma vez — a tela trabalha como uma planilha. */
export async function saveBudgetAction(id: string, header: BudgetHeaderValues, items: BudgetItemValues[]): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsedHeader = headerSchema.safeParse(header);
  const parsedItems = z.array(itemSchema).max(200).safeParse(items);
  if (!z.string().uuid().safeParse(id).success || !parsedHeader.success || !parsedItems.success) return INVALID;
  const h = parsedHeader.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({
      client_name: h.clientName,
      company_id: h.companyId || null,
      title: h.title,
      issue_date: h.issueDate,
      valid_until: h.validUntil,
      fee_pct: h.feePct,
      tax_pct: h.taxPct,
      status: h.status,
      payment_terms: h.paymentTerms || null,
      notes: h.notes || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar o orçamento." };

  const { error: deleteError } = await supabase.from("budget_items").delete().eq("budget_id", id);
  if (deleteError) return { ok: false, error: "Não foi possível salvar os itens." };
  if (parsedItems.data.length > 0) {
    const { error: insertError } = await supabase.from("budget_items").insert(
      parsedItems.data.map((item, index) => ({
        budget_id: id,
        section: item.section,
        catalog_item_id: item.catalogItemId,
        description: item.description,
        unit: item.unit || "unidade",
        quantity: item.quantity,
        unit_cost: item.unitCost,
        unit_price_override: item.unitPriceOverride,
        position: index,
      })),
    );
    if (insertError) return { ok: false, error: "Não foi possível salvar os itens." };
  }
  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${id}`);
  return { ok: true, message: "Orçamento salvo." };
}

export async function savePresentationAction(id: string, content: PresentationContent): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = presentationSchema.safeParse(content);
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return INVALID;
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ presentation: parsed.data }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar a apresentação." };
  revalidatePath(`/orcamentos/${id}`);
  return { ok: true, message: "Apresentação salva." };
}

export async function duplicateBudgetAction(id: string): Promise<ActionResult & { id?: string }> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const supabase = await createClient();
  const { data: source } = await supabase.from("budgets").select("*, items:budget_items(*)").eq("id", id).maybeSingle();
  if (!source) return { ok: false, error: "Orçamento não encontrado." };
  const { data: created, error } = await supabase
    .from("budgets")
    .insert({
      client_name: source.client_name,
      company_id: source.company_id,
      title: `${source.title} (cópia)`.slice(0, 160),
      fee_pct: source.fee_pct,
      tax_pct: source.tax_pct,
      payment_terms: source.payment_terms,
      notes: source.notes,
      presentation: source.presentation,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Não foi possível duplicar." };
  if (source.items.length > 0) {
    await supabase.from("budget_items").insert(
      source.items.map((item) => ({
        budget_id: created.id,
        section: item.section,
        catalog_item_id: item.catalog_item_id,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        unit_price_override: item.unit_price_override,
        position: item.position,
      })),
    );
  }
  revalidatePath("/orcamentos");
  return { ok: true, id: created.id, message: "Orçamento duplicado." };
}

export async function deleteBudgetAction(id: string): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível apagar." };
  revalidatePath("/orcamentos");
  return { ok: true, message: "Orçamento apagado." };
}

const catalogSchema = z.object({
  section: z.enum(["profissional", "custo"]),
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  unit: z.string().trim().min(1).max(30),
  defaultCost: money,
});

export async function saveCatalogItemAction(id: string | null, values: z.infer<typeof catalogSchema>): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = catalogSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const supabase = await createClient();
  const row = { section: parsed.data.section, name: parsed.data.name, unit: parsed.data.unit, default_cost: parsed.data.defaultCost };
  const { error } = id ? await supabase.from("budget_catalog_items").update(row).eq("id", id) : await supabase.from("budget_catalog_items").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe um item com esse nome." : "Não foi possível salvar." };
  revalidatePath("/orcamentos");
  return { ok: true, message: id ? "Item atualizado." : "Item adicionado ao catálogo." };
}

export async function toggleCatalogItemAction(id: string, active: boolean): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("budget_catalog_items").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar." };
  revalidatePath("/orcamentos");
  return { ok: true };
}

export async function saveProposalProfileAction(values: ProposalProfile): Promise<ActionResult> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const parsed = proposalProfileSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update({ proposal_profile: parsed.data, updated_by: profile.id }).eq("id", true);
  if (error) return { ok: false, error: "Não foi possível salvar o perfil." };
  revalidatePath("/orcamentos");
  return { ok: true, message: "Perfil da Além salvo." };
}
