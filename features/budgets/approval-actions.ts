"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import "@/features/prospeccao/goal-handlers";
import { computeBudget } from "@/features/budgets/pricing";
import { getBudget, getClientLinks } from "@/features/budgets/queries";
import { toCents } from "@/features/finance/money";
import { getCompanySettings } from "@/features/settings/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { approvalMessage, buildApprovalPayload, runApproval, type ApprovalInput } from "@/lib/budgets/approval";
import type { MarginThresholds } from "@/lib/margin";
import { quoteApproved } from "@/lib/prospeccao/events";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export interface ApprovalContext {
  budget: {
    id: string;
    number: number;
    label: string;
    title: string;
    clientName: string;
    totalCents: number;
    marginPct: number;
    companyId: string | null;
    projectId: string | null;
    dealId: string | null;
    dealTitle: string | null;
    dealCompanyId: string | null;
    paymentTerms: string;
  };
  /** Só id, descrição e seção — custo e preço dos itens não saem do orçamento. */
  items: { id: string; description: string; section: "profissional" | "custo" }[];
  projects: { id: string; name: string }[];
  financePeople: { id: string; name: string }[];
  thresholds: MarginThresholds;
}

async function requireBudgets() {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "budgets") ? profile : null;
}

function budgetLabel(number: number, version: number) {
  return `Orçamento nº ${String(number).padStart(4, "0")}${version > 1 ? ` v${version}` : ""}`;
}

/** Tudo o que o modal de aprovação precisa, lido do orçamento JÁ SALVO (os ids dos itens mudam a cada salvamento). */
export async function getApprovalContextAction(budgetId: string): Promise<{ ok: true; context: ApprovalContext } | { ok: false; error: string }> {
  if (!(await requireBudgets())) return { ok: false, error: "Sem acesso aos orçamentos." };
  if (!z.string().uuid().safeParse(budgetId).success) return { ok: false, error: "Orçamento inválido." };
  const budget = await getBudget(budgetId);
  if (!budget) return { ok: false, error: "Orçamento não encontrado." };

  const supabase = await createClient();
  const [total, people, deal, settings] = await Promise.all([
    supabase.rpc("budget_approval_total", { p_budget_id: budgetId }),
    supabase.rpc("finance_people_for_delegation"),
    budget.dealId ? supabase.from("deals").select("company_id").eq("id", budget.dealId).maybeSingle() : Promise.resolve({ data: null }),
    getCompanySettings(),
  ]);
  if (total.error) return { ok: false, error: "Não foi possível ler o total do orçamento." };
  const dealCompanyId = deal.data?.company_id ?? null;
  const companyId = dealCompanyId ?? budget.companyId;
  const links = await getClientLinks(companyId);

  return {
    ok: true,
    context: {
      budget: {
        id: budget.id,
        number: budget.number,
        label: budgetLabel(budget.number, budget.version),
        title: budget.title,
        clientName: budget.clientName,
        totalCents: toCents(total.data),
        marginPct: computeBudget(budget.items, budget.feePct, budget.taxPct).totals.marginPct,
        companyId,
        projectId: budget.projectId,
        dealId: budget.dealId,
        dealTitle: budget.dealTitle,
        dealCompanyId,
        paymentTerms: budget.paymentTerms,
      },
      items: budget.items.map((item) => ({ id: item.id, description: item.description, section: item.section })),
      projects: links.projects,
      financePeople: (people.data ?? []).map((person) => ({ id: person.profile_id, name: person.full_name })),
      thresholds: settings.margin,
    },
  };
}

/** Projetos de um cliente (o modal troca de cliente). */
export async function getApprovalProjectsAction(companyId: string): Promise<{ id: string; name: string }[]> {
  if (!(await requireBudgets()) || !z.string().uuid().safeParse(companyId).success) return [];
  return (await getClientLinks(companyId)).projects;
}

/**
 * Aprova: valida o pedido (lib/budgets/approval.ts) com os fatos do banco e chama approve_budget — uma transação
 * só. Falhou, nada foi criado.
 */
export async function approveBudgetAction(budgetId: string, input: ApprovalInput): Promise<{ ok: true; message: string; projectId: string } | { ok: false; error: string }> {
  if (!(await requireBudgets())) return { ok: false, error: "Sem acesso aos orçamentos." };
  if (!z.string().uuid().safeParse(budgetId).success) return { ok: false, error: "Orçamento inválido." };

  const supabase = await createClient();
  const [total, budgetRow, items] = await Promise.all([
    supabase.rpc("budget_approval_total", { p_budget_id: budgetId }),
    supabase.from("budgets").select("deal_id, deal:deals(company_id)").eq("id", budgetId).maybeSingle(),
    supabase.from("budget_items").select("id").eq("budget_id", budgetId),
  ]);
  if (total.error || !budgetRow.data) return { ok: false, error: "Orçamento não encontrado." };

  const built = buildApprovalPayload(input, {
    totalCents: toCents(total.data),
    dealCompanyId: budgetRow.data.deal?.company_id ?? null,
    itemIds: (items.data ?? []).map((item) => item.id),
  });
  if (!built.ok) return built;

  const result = await runApproval(
    async (id, payload) => {
      const { data, error } = await supabase.rpc("approve_budget", { p_budget_id: id, p_payload: payload as unknown as Json });
      return { data, error: error ? { message: error.message, code: error.code } : null };
    },
    budgetId,
    built.payload,
  );
  if (!result.ok) return result;

  // Meta vinculada ao negócio (Módulo 4B): falha de handler não desfaz a aprovação.
  if (result.outcome.dealId) await quoteApproved({ leadId: result.outcome.dealId, quoteId: budgetId, amount: toCents(total.data) / 100 });

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${budgetId}`);
  revalidatePath("/financeiro");
  revalidatePath("/crm");
  revalidatePath("/pautas");
  revalidatePath("/inicio");
  revalidatePath("/projetos", "layout");
  revalidatePath("/clientes", "layout");
  return { ok: true, message: approvalMessage(result.outcome, built.payload.payment.mode), projectId: result.outcome.projectId };
}
