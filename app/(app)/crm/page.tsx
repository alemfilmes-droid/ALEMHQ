import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { syncCrmAlertsAction } from "@/features/crm/actions";
import { ActivitiesFeed } from "@/features/crm/components/activities-feed";
import { ActivitiesFiltersPopover } from "@/features/crm/components/activities-filters-popover";
import { CrmDashboardTab } from "@/features/crm/components/dashboard-tab";
import { DealsFiltersPopover } from "@/features/crm/components/deals-filters-popover";
import { CrmFlowProvider } from "@/features/crm/components/flow/crm-flow-provider";
import { DealKanbanBoard } from "@/features/crm/components/kanban/deal-kanban-board";
import { LeadsTable } from "@/features/crm/components/leads-table";
import { NewDealDialog } from "@/features/crm/components/new-deal-dialog";
import { parseDealFilters } from "@/features/crm/filters";
import { getDealFormOptions, listDeals } from "@/features/crm/queries";
import { PeriodSelector } from "@/features/finance/components/period-selector";
import { resolvePeriod, todayISO } from "@/features/finance/period";
import { canManageAllDeals, hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "CRM" };

type SearchParams = Promise<Record<string, string | undefined>>;
type Params = Record<string, string | undefined>;
type Options = Awaited<ReturnType<typeof getDealFormOptions>>;

function splitParam(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function CrmPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  // O middleware já barra; esta checagem impede qualquer consulta do CRM sem a capability.
  if (!hasCapability(profile, "crm")) redirect("/inicio");
  // Fogo-e-esqueça: alertas de SLA da pessoa (no máximo um por negócio, tipo e dia — garantido no banco).
  void syncCrmAlertsAction();

  const params = await searchParams;
  const canManageAll = canManageAllDeals(profile);
  const canSeeFinance = hasCapability(profile, "finance");

  // O painel é da gestão (head, diretoria, master).
  const tabs = [
    { key: "funil", label: "Funil" },
    { key: "leads", label: "Leads" },
    { key: "atividades", label: "Atividades" },
    ...(canManageAll ? [{ key: "painel", label: "Painel" }] : []),
  ];
  const tab = tabs.find((item) => item.key === params.aba)?.key ?? "funil";

  const options = await getDealFormOptions();

  return (
    <CrmFlowProvider options={options} canManageAll={canManageAll} canSeeFinance={canSeeFinance} currentUserId={profile.id} initialOpenId={params.negocio}>
      <PageHeader
        panel="/crm"
        title="CRM."
        description="Funil comercial: contatos, qualificação, reuniões, propostas e fechamento."
        actions={<NewDealDialog options={options} canManageAll={canManageAll} defaultOwnerId={profile.id} />}
      />

      <div className="mb-6">
        <LinkTabs label="Seções do CRM" tabs={tabs.map((item) => ({ href: `/crm?aba=${item.key}`, label: item.label, active: item.key === tab }))} />
      </div>

      {tab === "funil" ? (
        <FunilTab params={params} options={options} />
      ) : tab === "leads" ? (
        <LeadsTab params={params} options={options} canManageAll={canManageAll} />
      ) : tab === "atividades" ? (
        <AtividadesTab params={params} options={options} />
      ) : (
        <PainelTab params={params} canEditRules={hasCapability(profile, "crmOverview")} canSeeFinance={canSeeFinance} />
      )}
    </CrmFlowProvider>
  );
}

async function FunilTab({ params, options }: { params: Params; options: Options }) {
  const deals = await listDeals(parseDealFilters(params));

  return (
    <div className="space-y-4">
      <Suspense>
        <DealsFiltersPopover options={options} />
      </Suspense>
      {/* Igual ao quadro de pautas: a página não rola — só cada coluna do funil rola. */}
      <div className="flex h-[calc(100dvh-24rem)] min-h-[480px] flex-col">
        <DealKanbanBoard deals={deals} />
      </div>
    </div>
  );
}

async function LeadsTab({ params, options, canManageAll }: { params: Params; options: Options; canManageAll: boolean }) {
  const deals = await listDeals(parseDealFilters(params));

  return (
    <div className="space-y-4">
      <Suspense>
        <DealsFiltersPopover options={options} />
      </Suspense>
      <LeadsTable deals={deals} options={options} canManageAll={canManageAll} />
    </div>
  );
}

async function AtividadesTab({ params, options }: { params: Params; options: Options }) {
  return (
    <div className="space-y-4">
      <Suspense>
        <ActivitiesFiltersPopover members={options.members} />
      </Suspense>
      <ActivitiesFeed ownerId={splitParam(params.responsavel)} kind={splitParam(params.tipo)} />
    </div>
  );
}

async function PainelTab({ params, canEditRules, canSeeFinance }: { params: Params; canEditRules: boolean; canSeeFinance: boolean }) {
  const period = resolvePeriod(params.periodo, params.de, params.ate, todayISO());

  return (
    <div className="space-y-6">
      <Suspense>
        <PeriodSelector period={period} />
      </Suspense>
      <CrmDashboardTab period={period} canEditRules={canEditRules} canSeeFinance={canSeeFinance} />
    </div>
  );
}
