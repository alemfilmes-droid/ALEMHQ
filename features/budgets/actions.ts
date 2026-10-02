"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { computeBudget } from "@/features/budgets/pricing";
import { getBudget } from "@/features/budgets/queries";
import { parsePresentation, presentationSchema, proposalProfileSchema, type PresentationContent, type ProposalProfile } from "@/features/budgets/types";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const FORBIDDEN: ActionResult = { ok: false, error: "Só o master acessa os orçamentos." };

async function requireMaster() {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "budgets") ? profile : null;
}

function refresh(id?: string) {
  revalidatePath("/orcamentos");
  if (id) revalidatePath(`/orcamentos/${id}`);
}

/** Primeira mensagem de validação, com o nome do campo — nada de "revise os campos" genérico. */
function firstIssue(error: z.ZodError, labels: Record<string, string>): string {
  const issue = error.issues[0];
  if (!issue) return "Revise os campos.";
  const path = issue.path.map(String);
  const field = labels[path[path.length - 1] ?? ""] ?? path.join(".");
  const row = typeof issue.path[1] === "number" ? ` (linha ${Number(issue.path[1]) + 1})` : "";
  return `${field}${row}: ${issue.message}`;
}

const LABELS: Record<string, string> = {
  clientName: "Nome do cliente",
  companyId: "Cliente cadastrado",
  projectId: "Projeto",
  title: "Projeto",
  issueDate: "Data do orçamento",
  validUntil: "Validade",
  feePct: "FEE",
  taxPct: "Imposto",
  paymentTerms: "Condições",
  notes: "Observações",
  deliverables: "Entregas",
  description: "Item",
  unit: "Unidade",
  quantity: "Quantidade",
  unitCost: "Custo",
  unitPriceOverride: "Valor ao cliente",
};

const optionalId = z.string().trim().max(64).nullable().optional().transform((value) => (value ? value : null));
const number = z.coerce.number().refine(Number.isFinite, "valor inválido");

const headerSchema = z.object({
  clientName: z.string().trim().min(2, "informe o nome").max(160),
  companyId: optionalId,
  projectId: optionalId,
  title: z.string().trim().min(2, "informe o projeto").max(160),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
  feePct: number.pipe(z.number().min(0, "não pode ser negativo").max(999)),
  taxPct: number.pipe(z.number().min(0, "não pode ser negativo").max(99, "use até 99%")),
  paymentTerms: z.string().trim().max(1000, "use até 1000 caracteres").default(""),
  notes: z.string().trim().max(2000, "use até 2000 caracteres").default(""),
  deliverables: z.array(z.string().trim().max(300)).max(40).default([]),
});

const itemSchema = z.object({
  section: z.enum(["profissional", "custo"]),
  catalogItemId: optionalId,
  description: z.string().trim().min(1, "sem descrição").max(160, "use até 160 caracteres"),
  unit: z.string().trim().max(30, "use até 30 caracteres").default("unidade"),
  quantity: number.pipe(z.number().positive("precisa ser maior que zero").max(100_000)),
  unitCost: number.pipe(z.number().min(0, "não pode ser negativo").max(100_000_000)),
  unitPriceOverride: z.union([z.null(), number.pipe(z.number().min(0).max(100_000_000))]).default(null),
});

export type BudgetHeaderValues = z.input<typeof headerSchema>;
export type BudgetItemValues = z.input<typeof itemSchema>;

export async function createBudgetAction(input: { clientName: string; companyId: string; projectId: string; title: string }): Promise<ActionResult & { id?: string }> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const parsed = z
    .object({ clientName: z.string().trim().min(2).max(160), companyId: optionalId, projectId: optionalId, title: z.string().trim().min(2).max(160) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informe o cliente e o nome do projeto." };

  const supabase = await createClient();
  // FEE e imposto começam iguais aos do último orçamento (é o padrão da casa).
  const { data: last } = await supabase.from("budgets").select("fee_pct, tax_pct, payment_terms").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      client_name: parsed.data.clientName,
      company_id: parsed.data.companyId,
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      fee_pct: last?.fee_pct ?? 30,
      tax_pct: last?.tax_pct ?? 6,
      payment_terms: last?.payment_terms ?? "50% na aprovação e 50% na entrega.",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível criar o orçamento." };
  refresh();
  return { ok: true, id: data.id };
}

/** Salva o orçamento inteiro (cabeçalho + itens) de uma vez — a tela trabalha como uma planilha. */
export async function saveBudgetAction(id: string, header: BudgetHeaderValues, items: BudgetItemValues[]): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Orçamento inválido." };
  const parsedHeader = headerSchema.safeParse(header);
  if (!parsedHeader.success) return { ok: false, error: firstIssue(parsedHeader.error, LABELS) };
  const parsedItems = z.array(itemSchema).max(200, "use até 200 itens").safeParse(items);
  if (!parsedItems.success) return { ok: false, error: firstIssue(parsedItems.error, LABELS) };
  const h = parsedHeader.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({
      client_name: h.clientName,
      company_id: h.companyId,
      project_id: h.projectId,
      title: h.title,
      issue_date: h.issueDate,
      valid_until: h.validUntil,
      fee_pct: h.feePct,
      tax_pct: h.taxPct,
      payment_terms: h.paymentTerms || null,
      notes: h.notes || null,
      deliverables: h.deliverables.filter(Boolean),
    })
    .eq("id", id);
  if (error) return { ok: false, error: `Não foi possível salvar o orçamento (${error.message}).` };

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
    if (insertError) return { ok: false, error: `Não foi possível salvar os itens (${insertError.message}).` };
  }
  refresh(id);
  return { ok: true, message: "Orçamento salvo." };
}

export async function savePresentationAction(id: string, content: PresentationContent): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = presentationSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssue(parsed.error, {
        accent: "Cor",
        clientLogoUrl: "Logo do cliente",
        context: "Contexto",
        objective: "Objetivo",
        concept: "Conceito",
        narrative: "Narrativa",
        deliverables: "Entregáveis",
        timeline: "Cronograma",
        references: "Referências",
        closing: "Encerramento",
      }),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").update({ presentation: parsed.data }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar a apresentação." };
  refresh(id);
  return { ok: true, message: "Apresentação salva." };
}

// ---------------------------------------------------------------------------
// Ciclo do orçamento: enviar (e registrar no CRM), decisão do cliente e nova versão
// ---------------------------------------------------------------------------

const CHANNELS = ["whatsapp_pdf", "email", "ligacao", "meet", "presencial"] as const;

export async function sendBudgetAction(id: string, input: { dealId: string; channel: (typeof CHANNELS)[number] }): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = z.object({ dealId: optionalId, channel: z.enum(CHANNELS) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise o envio." };
  const budget = await getBudget(id);
  if (!budget) return { ok: false, error: "Orçamento não encontrado." };
  const { totals } = computeBudget(budget.items, budget.feePct, budget.taxPct);
  if (totals.final <= 0) return { ok: false, error: "O orçamento está sem valor." };

  const supabase = await createClient();
  let proposalId: string | null = null;
  if (parsed.data.dealId) {
    // Proposta no negócio do CRM: aparece no card do cliente e em "valores em negociação".
    const nextAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { data, error } = await supabase.rpc("deal_register_proposal", {
      p_deal_id: parsed.data.dealId,
      p_amount: totals.final,
      p_channel: parsed.data.channel,
      p_document_url: "",
      p_scope_notes: `Orçamento nº ${String(budget.number).padStart(4, "0")}${budget.version > 1 ? ` v${budget.version}` : ""} · ${budget.title}`,
      p_next_action: "Cobrar retorno do orçamento",
      p_next_action_at: nextAt,
    });
    if (error) return { ok: false, error: `CRM: ${error.message}` };
    proposalId = data ?? null;
  }

  const { error } = await supabase
    .from("budgets")
    .update({ status: "enviado", sent_at: new Date().toISOString(), deal_id: parsed.data.dealId, deal_proposal_id: proposalId, decided_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: "Não foi possível marcar como enviado." };
  refresh(id);
  revalidatePath("/crm");
  revalidatePath("/financeiro");
  return { ok: true, message: parsed.data.dealId ? "Enviado e registrado no CRM do cliente." : "Marcado como enviado." };
}

const DECISION_TO_PROPOSAL = { aprovado: "aceita", em_ajuste: "em_negociacao", recusado: "recusada" } as const;

export async function decideBudgetAction(id: string, input: { status: "aprovado" | "em_ajuste" | "recusado"; note: string }): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = z.object({ status: z.enum(["aprovado", "em_ajuste", "recusado"]), note: z.string().trim().max(1000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise a decisão." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ status: parsed.data.status, status_note: parsed.data.note || null, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Não foi possível atualizar." };
  await supabase.rpc("budget_set_proposal_status", { p_budget_id: id, p_status: DECISION_TO_PROPOSAL[parsed.data.status] });
  refresh(id);
  revalidatePath("/crm");
  revalidatePath("/financeiro");
  const messages = {
    aprovado: "Aprovado! Para fechar o negócio no CRM, marque como ganho no card do cliente.",
    em_ajuste: "Marcado em ajuste. Use “Refazer” para criar a nova versão.",
    recusado: "Marcado como recusado.",
  } as const;
  return { ok: true, message: messages[parsed.data.status] };
}

/** Refazer: nova versão (v2, v3…) a partir desta, com o mesmo número, para ajustar e reenviar. */
export async function redoBudgetAction(id: string): Promise<ActionResult & { id?: string }> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const supabase = await createClient();
  const { data: source } = await supabase.from("budgets").select("*, items:budget_items(*)").eq("id", id).maybeSingle();
  if (!source) return { ok: false, error: "Orçamento não encontrado." };
  const { data: newest } = await supabase.from("budgets").select("version").eq("number", source.number).order("version", { ascending: false }).limit(1).maybeSingle();
  return copyBudget(source, { number: source.number, version: (newest?.version ?? source.version) + 1, parentId: source.id, title: source.title, profileId: profile.id, keepLinks: true });
}

export async function duplicateBudgetAction(id: string): Promise<ActionResult & { id?: string }> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const supabase = await createClient();
  const { data: source } = await supabase.from("budgets").select("*, items:budget_items(*)").eq("id", id).maybeSingle();
  if (!source) return { ok: false, error: "Orçamento não encontrado." };
  return copyBudget(source, { number: null, version: 1, parentId: null, title: `${source.title} (cópia)`.slice(0, 160), profileId: profile.id, keepLinks: false });
}

interface SourceBudget {
  client_name: string;
  company_id: string | null;
  project_id: string | null;
  deal_id: string | null;
  fee_pct: number;
  tax_pct: number;
  payment_terms: string | null;
  notes: string | null;
  presentation: unknown;
  deliverables: string[];
  items: { section: "profissional" | "custo"; catalog_item_id: string | null; description: string; unit: string; quantity: number; unit_cost: number; unit_price_override: number | null; position: number }[];
}

async function copyBudget(
  row: SourceBudget,
  options: { number: number | null; version: number; parentId: string | null; title: string; profileId: string; keepLinks: boolean },
): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("budgets")
    .insert({
      ...(options.number ? { number: options.number } : {}),
      version: options.version,
      parent_id: options.parentId,
      client_name: row.client_name,
      company_id: row.company_id,
      project_id: row.project_id,
      deal_id: options.keepLinks ? row.deal_id : null,
      title: options.title,
      fee_pct: row.fee_pct,
      tax_pct: row.tax_pct,
      payment_terms: row.payment_terms,
      notes: row.notes,
      presentation: parsePresentation(row.presentation),
      deliverables: row.deliverables,
      created_by: options.profileId,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: `Não foi possível criar a nova versão (${error?.message ?? "erro"}).` };
  if (row.items.length > 0) {
    await supabase.from("budget_items").insert(
      row.items.map((item) => ({
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
  refresh();
  return { ok: true, id: created.id, message: options.parentId ? `Versão ${options.version} criada.` : "Orçamento duplicado." };
}

export async function deleteBudgetAction(id: string): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível apagar." };
  refresh();
  return { ok: true, message: "Orçamento apagado." };
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

const catalogSchema = z.object({
  section: z.enum(["profissional", "custo"]),
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  unit: z.string().trim().min(1, "Informe a unidade.").max(30),
  defaultCost: number.pipe(z.number().min(0).max(100_000_000)),
});

export async function saveCatalogItemAction(id: string | null, values: z.input<typeof catalogSchema>): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const parsed = catalogSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const supabase = await createClient();
  const row = { section: parsed.data.section, name: parsed.data.name, unit: parsed.data.unit, default_cost: parsed.data.defaultCost };
  let error;
  if (id) {
    ({ error } = await supabase.from("budget_catalog_items").update(row).eq("id", id));
  } else {
    const { data: last } = await supabase.from("budget_catalog_items").select("position").eq("section", parsed.data.section).order("position", { ascending: false }).limit(1).maybeSingle();
    ({ error } = await supabase.from("budget_catalog_items").insert({ ...row, position: (last?.position ?? 0) + 1 }));
  }
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe um item com esse nome." : "Não foi possível salvar." };
  refresh();
  return { ok: true, message: id ? "Item atualizado." : "Item adicionado ao catálogo." };
}

export async function toggleCatalogItemAction(id: string, active: boolean): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("budget_catalog_items").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar." };
  refresh();
  return { ok: true };
}

/** Ordem do catálogo (arrastar). Recebe os ids de uma seção na ordem nova. */
export async function reorderCatalogAction(ids: string[]): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  if (!z.array(z.string().uuid()).max(500).safeParse(ids).success) return { ok: false, error: "Ordem inválida." };
  const supabase = await createClient();
  const results = await Promise.all(ids.map((itemId, index) => supabase.from("budget_catalog_items").update({ position: index + 1 }).eq("id", itemId)));
  if (results.some((result) => result.error)) return { ok: false, error: "Não foi possível salvar a ordem." };
  refresh();
  return { ok: true };
}

/** Apaga do catálogo. Orçamentos que já usaram o item mantêm a linha (só perdem o vínculo). */
export async function deleteCatalogItemAction(id: string): Promise<ActionResult> {
  if (!(await requireMaster())) return FORBIDDEN;
  const supabase = await createClient();
  const { error } = await supabase.from("budget_catalog_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível apagar." };
  refresh();
  return { ok: true, message: "Item apagado do catálogo." };
}

export async function saveProposalProfileAction(values: ProposalProfile): Promise<ActionResult> {
  const profile = await requireMaster();
  if (!profile) return FORBIDDEN;
  const parsed = proposalProfileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update({ proposal_profile: parsed.data, updated_by: profile.id }).eq("id", true);
  if (error) return { ok: false, error: "Não foi possível salvar o perfil." };
  refresh();
  return { ok: true, message: "Perfil da Além salvo." };
}

/** Projetos e negócios abertos de um cliente (para o diálogo de novo orçamento e o envio). */
export async function getClientLinksAction(companyId: string): Promise<{ projects: { id: string; name: string }[]; deals: { id: string; title: string; stage: string }[] }> {
  if (!(await requireMaster()) || !z.string().uuid().safeParse(companyId).success) return { projects: [], deals: [] };
  const { getClientLinks } = await import("@/features/budgets/queries");
  return getClientLinks(companyId);
}
