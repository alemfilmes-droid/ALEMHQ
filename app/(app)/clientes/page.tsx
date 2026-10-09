import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircle, Building2 } from "lucide-react";
import { ClientTierBoard, TIER_COLUMNS, TierColumn, type TierColumnKey } from "@/components/companies/client-tier-board";
import { CompanyCard } from "@/components/companies/company-card";
import { CompanyFilters } from "@/components/companies/company-filters";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { CLIENT_HEALTHS } from "@/lib/validations/health";
import { createClient } from "@/lib/supabase/server";
import type { ClientHealth, Company, CompanyLifecycle } from "@/types";

export const metadata: Metadata = { title: "Clientes" };

type SearchParams = Promise<{ aba?: string; saude?: string; cidade?: string; busca?: string }>;

type CompanyStats = { active: number; lastActivity: string | null };

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { aba, saude, cidade, busca } = await searchParams;
  const lifecycle: CompanyLifecycle = aba === "prospects" ? "prospect" : aba === "ex-clientes" ? "former_client" : "client";
  const isClientTab = lifecycle === "client";
  const canManage = hasCapability(profile, "manageCompanies");

  const health = CLIENT_HEALTHS.find((item): item is ClientHealth => item === saude);
  const search = busca?.trim();

  const supabase = await createClient();
  let query = supabase.from("companies").select("*").eq("lifecycle", lifecycle).order("name");
  if (health) query = query.eq("health", health);
  if (cidade) query = query.ilike("city", `%${escapeLike(cidade)}%`);
  if (search) query = query.ilike("name", `%${escapeLike(search)}%`);

  const [{ data: companies, error }, ranking] = await Promise.all([
    query,
    // Ordem por valor de contrato (soma dos projetos): todos recebem a ORDEM; o valor só vem para
    // quem tem acesso ao financeiro (a própria função decide, igual à RLS de project_financials).
    isClientTab ? supabase.rpc("company_contract_ranking") : Promise.resolve({ data: [] as { company_id: string; rank: number; total_value: number | null }[] }),
  ]);
  const companyIds = (companies ?? []).map((company) => company.id);

  const { data: projects } = companyIds.length
    ? await supabase.from("projects").select("company_id, stage, created_at").in("company_id", companyIds)
    : { data: [] as { company_id: string | null; stage: string; created_at: string }[] };

  const stats = new Map<string, CompanyStats>();
  for (const project of projects ?? []) {
    if (!project.company_id) continue;
    const current = stats.get(project.company_id) ?? { active: 0, lastActivity: null };
    if (project.stage !== "entregue" && project.stage !== "cancelado" && project.stage !== "encerrado") current.active += 1;
    if (!current.lastActivity || project.created_at > current.lastActivity) current.lastActivity = project.created_at;
    stats.set(project.company_id, current);
  }

  const rankById = new Map((ranking.data ?? []).map((row) => [row.company_id, row]));
  const hasFilters = Boolean(health || cidade || search);

  function card(company: Company, hideTier: boolean) {
    const companyStats = stats.get(company.id) ?? { active: 0, lastActivity: null };
    return (
      <CompanyCard
        key={company.id}
        company={company}
        activeProjects={companyStats.active}
        lastActivity={companyStats.lastActivity}
        canManage={canManage}
        contractValue={rankById.get(company.id)?.total_value ?? null}
        hideTier={hideTier}
      />
    );
  }

  // Coluna por nível, cada uma do maior para o menor valor de contrato (sem contrato: por nome, no fim).
  const columns = new Map<TierColumnKey, Company[]>(TIER_COLUMNS.map((key) => [key, []]));
  for (const company of companies ?? []) columns.get(company.tier ?? "sem_nivel")?.push(company);
  for (const list of columns.values()) {
    list.sort((a, b) => (rankById.get(a.id)?.rank ?? Number.MAX_SAFE_INTEGER) - (rankById.get(b.id)?.rank ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "pt-BR"));
  }
  const columnTotal = (list: Company[]) => {
    const values = list.map((company) => rankById.get(company.id)?.total_value);
    return values.some((value) => value != null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  };

  return (
    <>
      <PageHeader
        panel="/clientes"
        eyebrow="Operação"
        title="Clientes."
        description="Clientes por nível de ticket, do maior para o menor contrato. Prospects ficam na aba própria."
        actions={canManage && lifecycle !== "former_client" ? <CompanyFormDialog key={lifecycle} mode="create" defaultLifecycle={lifecycle} /> : null}
      />

      <div className="mb-6">
        <LinkTabs
          label="Situação"
          tabs={[
            { href: "/clientes", label: "Clientes", active: isClientTab },
            { href: "/clientes?aba=prospects", label: "Prospects", active: lifecycle === "prospect" },
            { href: "/clientes?aba=ex-clientes", label: "Ex-clientes", active: lifecycle === "former_client" },
          ]}
        />
      </div>

      <div className="mb-6">
        <Suspense>
          <CompanyFilters />
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
            {hasFilters ? "Nenhuma empresa com esses filtros." : isClientTab ? "Nenhum cliente cadastrado." : lifecycle === "former_client" ? "Nenhum ex-cliente." : "Nenhum prospect cadastrado."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Ajuste ou limpe os filtros." : "Use “Nova empresa” para começar."}</p>
        </div>
      ) : isClientTab ? (
        <ClientTierBoard>
          {TIER_COLUMNS.map((tier) => {
            const list = columns.get(tier) ?? [];
            return (
              <TierColumn key={tier} tier={tier} count={list.length} total={columnTotal(list)}>
                {list.map((company) => card(company, true))}
              </TierColumn>
            );
          })}
        </ClientTierBoard>
      ) : (
        <div className="card-grid">{companies.map((company) => card(company, false))}</div>
      )}
    </>
  );
}
