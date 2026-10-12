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
import { getDealFormOptions, getOpenRequestCounts, listDeals } from "@/features/crm/queries";
import { PeriodSelector } from "@/features/finance/components/period-selector";
import { resolvePeriod, todayISO } from "@/features/finance/period";
import { canManageAllDeals, hasCapability, isDirectorOrAdmin } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { CrmProspectView, loadQueue, type LeadsView } from "@/features/prospeccao/components/crm-prospect-view";
import { isDemoEnabled } from "@/features/prospeccao/demo";
import { touchLabel } from "@/features/prospeccao/status";
import type { QueueItem } from "@/features/prospeccao/types";
import { loadEffort } from "@/features/prospeccao/effort-queries";
import { ObjectionReportView } from "@/features/prospeccao/components/objection-report-view";
import { loadObjectionReport } from "@/features/prospeccao/report-queries";
import { isDueNow } from "@/lib/prospeccao/cadence";
import { effortLine } from "@/lib/prospeccao/effort";

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
    // Relatórios › Objeções: gestão e head do comercial (mesma regra de "ver todos os negócios").
    ...(canManageAll ? [{ key: "relatorios", label: "Relatórios" }] : []),
  ];
  // Squad comercial abre o CRM em Leads › Chamar hoje (a fila de toques do dia).
  const isCommercial = profile.squads.includes("comercial");
  const tab = tabs.find((item) => item.key === params.aba)?.key ?? (isCommercial ? "leads" : "funil");

  const [options, openRequests] = await Promise.all([getDealFormOptions(), getOpenRequestCounts()]);

  return (
    <CrmFlowProvider options={options} canManageAll={canManageAll} canSeeFinance={canSeeFinance} currentUserId={profile.id} isCeo={isDirectorOrAdmin(profile)} initialOpenId={params.negocio} openRequests={openRequests}>
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
        <LeadsTab
          params={params}
          options={options}
          canManageAll={canManageAll}
          defaultView={isCommercial ? "chamar-hoje" : "todos"}
          canAct={hasCapability(profile, "prospectActions")}
          profileId={profile.id}
        />
      ) : tab === "atividades" ? (
        <AtividadesTab params={params} options={options} />
      ) : tab === "relatorios" ? (
        <RelatoriosTab params={params} />
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

const LEADS_VIEWS: { key: LeadsView; label: string }[] = [
  { key: "chamar-hoje", label: "Chamar hoje" },
  { key: "prospeccao", label: "Prospecção" },
  { key: "todos", label: "Todos os negócios" },
];

async function LeadsTab({
  params,
  options,
  canManageAll,
  defaultView,
  canAct,
  profileId,
}: {
  params: Params;
  options: Options;
  canManageAll: boolean;
  defaultView: LeadsView;
  canAct: boolean;
  profileId: string;
}) {
  const view = LEADS_VIEWS.find((item) => item.key === params.visao)?.key ?? defaultView;
  const demo = isDemoEnabled(params.demo);
  const hrefFor = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams({ aba: "leads" });
    for (const [key, value] of Object.entries({ demo: demo ? "1" : undefined, ...extra })) if (value) query.set(key, value);
    return `/crm?${query.toString()}`;
  };
  const [queue, effort] = await Promise.all([loadQueue(demo), loadEffort()]);
  const mine = effort.people.find((person) => person.id === profileId);
  // Quem não é do comercial (gestão) vê o total do time.
  const touches = mine?.touchesToday ?? effort.people.reduce((sum, person) => sum + person.touchesToday, 0);
  const meetings = mine?.meetingsWeek ?? effort.people.reduce((sum, person) => sum + person.meetingsWeek, 0);
  const line = effortLine(touches, effort.touchTarget, meetings, effort.meetingTarget);
  const dueCount = queue.items.filter((item) => isDueNow(item.state)).length;

  return (
    <div className="space-y-4">
      <LinkTabs
        label="Visões de leads"
        tone="neutral"
        tabs={LEADS_VIEWS.map((item) => ({
          href: hrefFor({ visao: item.key }),
          label: item.key === "chamar-hoje" ? `${item.label} · ${dueCount}` : item.label,
          active: item.key === view,
        }))}
      />
      {view === "todos" ? (
        <AllLeads params={params} options={options} canManageAll={canManageAll} queue={queue.items} />
      ) : (
        <CrmProspectView
          view={view}
          status={params.status}
          house={params.casa}
          effortLine={line}
          hrefFor={(extra) => hrefFor({ visao: view, ...extra })}
          queue={queue}
          canAct={canAct}
        />
      )}
    </div>
  );
}

async function AllLeads({ params, options, canManageAll, queue }: { params: Params; options: Options; canManageAll: boolean; queue: QueueItem[] }) {
  const deals = await listDeals(parseDealFilters(params));
  const prospect = Object.fromEntries(
    queue.map((item) => [item.dealId, { status: item.state.status, touch: touchLabel(item.state), playbookName: item.playbookName }]),
  );

  return (
    <div className="space-y-4">
      <Suspense>
        <DealsFiltersPopover options={options} />
      </Suspense>
      <LeadsTable deals={deals} options={options} canManageAll={canManageAll} prospect={prospect} />
    </div>
  );
}

const REPORT_PERIODS = ["30d", "trimestre", "tudo"] as const;

async function RelatoriosTab({ params }: { params: Params }) {
  const period = REPORT_PERIODS.find((item) => item === params.periodo) ?? "30d";
  const report = await loadObjectionReport(period);
  return <ObjectionReportView report={report} period={period} hrefFor={(next) => `/crm?aba=relatorios&periodo=${next}`} />;
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
