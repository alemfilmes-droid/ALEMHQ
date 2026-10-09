"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageCompanyLogos } from "@/lib/auth/permissions";
import { publicEnv } from "@/lib/env";
import { authorizeCapability, getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  companySchema,
  contactSchema,
  nullIfEmpty,
  updateContactSchema,
  type CompanyValues,
  type ContactValues,
  type UpdateContactValues,
} from "@/lib/validations/company";
import { updateHealthSchema, updateTierSchema, type UpdateHealthValues, type UpdateTierValues } from "@/lib/validations/health";
import type { ActionResult } from "@/types";

const FORBIDDEN: ActionResult = { ok: false, error: "Você não tem permissão para esta ação." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };

function toCompanyRow(values: z.infer<typeof companySchema>) {
  const source = values.source === "" ? null : values.source;
  return {
    name: values.name,
    // "Ex-cliente" só pelo encerramento: o formulário nunca grava nem desfaz essa situação.
    ...(values.lifecycle === "former_client" ? {} : { lifecycle: values.lifecycle }),
    source,
    source_detail: source ? nullIfEmpty(values.sourceDetail) : null,
    document: nullIfEmpty(values.document),
    city: nullIfEmpty(values.city),
    instagram: nullIfEmpty(values.instagram),
    website: nullIfEmpty(values.website),
  };
}

/** Cliente cadastrado direto (lifecycle 'client') não passa pelo CRM; became_client_at vem do trigger. */
export async function createCompanyAction(values: CompanyValues): Promise<ActionResult> {
  if (!(await authorizeCapability("manageCompanies"))) return FORBIDDEN;
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").insert(toCompanyRow(parsed.data)).select("id").single();
  if (error) return { ok: false, error: "Não foi possível cadastrar a empresa." };

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function updateCompanyAction(id: string, values: CompanyValues): Promise<ActionResult> {
  if (!(await authorizeCapability("manageCompanies"))) return FORBIDDEN;
  const parsed = companySchema.safeParse(values);
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(toCompanyRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar a empresa." };

  revalidatePath("/clientes", "layout");
  return { ok: true, message: "Empresa atualizada." };
}

export async function createContactAction(companyId: string, values: ContactValues): Promise<ActionResult> {
  if (!(await authorizeCapability("manageCompanies"))) return FORBIDDEN;
  const parsed = contactSchema.safeParse(values);
  if (!z.string().uuid().safeParse(companyId).success || !parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    company_id: companyId,
    full_name: parsed.data.fullName,
    job_title: nullIfEmpty(parsed.data.jobTitle),
    email: nullIfEmpty(parsed.data.email),
    phone: nullIfEmpty(parsed.data.phone),
    is_decision_maker: parsed.data.isDecisionMaker,
  });
  if (error) return { ok: false, error: "Não foi possível adicionar o contato." };

  revalidatePath(`/clientes/${companyId}`);
  revalidatePath("/projetos", "layout");
  return { ok: true, message: "Contato adicionado." };
}

export async function updateContactAction(values: UpdateContactValues): Promise<ActionResult> {
  if (!(await authorizeCapability("manageCompanies"))) return FORBIDDEN;
  const parsed = updateContactSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .update({
      full_name: parsed.data.fullName,
      job_title: nullIfEmpty(parsed.data.jobTitle),
      email: nullIfEmpty(parsed.data.email),
      phone: nullIfEmpty(parsed.data.phone),
      is_decision_maker: parsed.data.isDecisionMaker,
    })
    .eq("id", parsed.data.id)
    .select("company_id")
    .single();
  if (error) return { ok: false, error: "Não foi possível salvar o contato." };

  revalidatePath(`/clientes/${contact.company_id}`);
  revalidatePath("/projetos", "layout");
  return { ok: true, message: "Contato atualizado." };
}

export async function updateCompanyHealthAction(values: UpdateHealthValues): Promise<ActionResult> {
  if (!(await authorizeCapability("manageCompanies"))) return FORBIDDEN;
  const parsed = updateHealthSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ health: parsed.data.health, health_note: nullIfEmpty(parsed.data.note) })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Não foi possível atualizar a saúde do cliente." };

  revalidatePath("/clientes", "layout");
  return { ok: true, message: "Saúde do cliente atualizada." };
}

/** Bloqueado no banco para quem ainda é prospect (trigger companies_guard_tier). */
export async function updateCompanyTierAction(values: UpdateTierValues): Promise<ActionResult> {
  if (!(await authorizeCapability("manageCompanies"))) return FORBIDDEN;
  const parsed = updateTierSchema.safeParse(values);
  if (!parsed.success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update({ tier: parsed.data.tier }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Não foi possível atualizar o nível do cliente." };

  revalidatePath("/clientes", "layout");
  return { ok: true, message: "Nível do cliente atualizado." };
}

/**
 * Logo do cliente: o arquivo já foi enviado ao bucket "company-logos" pelo navegador (as policies
 * do Storage checam a permissão); aqui só gravamos a URL pela RPC set_company_logo, que confere de
 * novo quem pode trocar. `null` remove o logo.
 */
export async function setCompanyLogoAction(companyId: string, logoUrl: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !canManageCompanyLogos(profile)) return FORBIDDEN;
  if (!z.string().uuid().safeParse(companyId).success) return INVALID;
  // Só aceita o arquivo do próprio cliente no bucket do projeto — nunca uma URL externa qualquer.
  const logoPrefix = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/company-logos/${companyId}/`;
  if (logoUrl !== null && (!z.string().url().max(1000).safeParse(logoUrl).success || !logoUrl.startsWith(logoPrefix))) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_logo", { p_company_id: companyId, p_logo_url: logoUrl ?? "" });
  if (error) return { ok: false, error: error.code === "42501" ? error.message : "Não foi possível salvar o logo." };

  // O logo aparece em todo lugar onde o cliente aparece.
  revalidatePath("/", "layout");
  return { ok: true, message: logoUrl ? "Logo atualizado." : "Logo removido." };
}
