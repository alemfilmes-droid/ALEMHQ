import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircle, Building2 } from "lucide-react";
import { CompanyCard } from "@/components/companies/company-card";
import { CompanyFilters } from "@/components/companies/company-filters";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { CLIENT_HEALTHS } from "@/lib/validations/health";
import { TIERS } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { ClientHealth, ClientTier, CompanyLifecycle } from "@/types";

export const metadata: Metadata = { title: "Clientes" };

type SearchParams = Promise<{ aba?: string; saude?: string; nivel?: string; cidade?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { aba, saude, nivel, cidade } = await searchParams;
  const lifecycle: CompanyLifecycle = aba === "prospects" ? "prospect" : "client";
  const isClientTab = lifecycle === "client";
  const canManage = hasCapability(profile, "manageCompanies");

  const health = CLIENT_HEALTHS.find((item): item is ClientHealth => item === saude);
  const tier = isClientTab ? TIERS.find((item): item is ClientTier => item === nivel) : undefined;

  const supabase = await createClient();
  let query = supabase.from("companies").select("*").eq("lifecycle", lifecycle).order("name");
  if (health) query = query.eq("health", health);
  if (tier) query = query.eq("tier", tier);
  if (cidade) query = query.ilike("city", `%${cidade}%`);

  const { data: companies, error } = await query;
  const companyIds = (companies ?? []).map((company) => company.id);

  const { data: projects } = companyIds.length
    ? await supabase.from("projects").select("company_id, stage, created_at").in("company_id", companyIds)
    : { data: [] as { company_id: string | null; stage: string; created_at: string }[] };

  const stats = new Map<string, { active: number; lastActivity: string | null }>();
  for (const project of projects ?? []) {
    if (!project.company_id) continue;
    const current = stats.get(project.company_id) ?? { active: 0, lastActivity: null };
    if (project.stage !== "entregue" && project.stage !== "cancelado") current.active += 1;
    if (!current.lastActivity || project.created_at > current.lastActivity) current.lastActivity = project.created_at;
    stats.set(project.company_id, current);
  }

  const hasFilters = Boolean(health || tier || cidade);

  return (
    <>
      <PageHeader
        panel="/clientes"
        eyebrow="Operação"
        title="Clientes."
        description="Empresas atendidas e em prospecção. O CRM não é necessário para cadastrar um cliente."
        actions={
          canManage ? (
            // A aba define a situação inicial do formulário.
            <CompanyFormDialog key={lifecycle} mode="create" defaultLifecycle={lifecycle} />
          ) : null
        }
      />

      <div className="mb-6">
        <LinkTabs
          label="Situação"
          tabs={[
            { href: "/clientes", label: "Clientes", active: isClientTab },
            { href: "/clientes?aba=prospects", label: "Prospects", active: !isClientTab },
          ]}
        />
      </div>

      <div className="mb-6">
        <Suspense>
          <CompanyFilters showTier={isClientTab} />
        </Suspense>
      </div>

      {error ? (
        <div role="alert" className="flex items-center gap-3 rounded-lg border-2 border-foreground p-4 text-sm font-semibold">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          Não foi possível carregar as empresas. Recarregue a página.
        </div>
      ) : !companies || companies.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
          <Building2 className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="font-bold">
            {hasFilters ? "Nenhuma empresa com esses filtros." : isClientTab ? "Nenhum cliente cadastrado." : "Nenhum prospect cadastrado."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Ajuste ou limpe os filtros." : "Use “Nova empresa” para começar."}</p>
        </div>
      ) : (
        <div className="card-grid">
          {companies.map((company) => {
            const companyStats = stats.get(company.id) ?? { active: 0, lastActivity: null };
            return (
              <CompanyCard
                key={company.id}
                company={company}
                activeProjects={companyStats.active}
                lastActivity={companyStats.lastActivity}
                canManage={canManage}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
