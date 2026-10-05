import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { ByClientTab } from "@/features/finance/components/by-client-tab";
import { CashFlowTab } from "@/features/finance/components/cash-flow-tab";
import { CompanyCostsTab } from "@/features/finance/components/company-costs-tab";
import { parseCompanyCostFilters } from "@/features/finance/company-costs";
import { DashboardTab } from "@/features/finance/components/dashboard-tab";
import { FiltersPopover } from "@/features/finance/components/filters-popover";
import { NegotiationTab } from "@/features/finance/components/negotiation-tab";
import { PayableDialog } from "@/features/finance/components/payable-dialog";
import { PayablesTable } from "@/features/finance/components/payables-table";
import { PeriodSelector } from "@/features/finance/components/period-selector";
import { ReceivableDialog } from "@/features/finance/components/receivable-dialog";
import { ReceivablesTable } from "@/features/finance/components/receivables-table";
import {
  FIXED_VARIABLE_LABELS,
  PAYABLE_CATEGORIES,
  PAYABLE_CATEGORY_LABELS,
  PAYABLE_COST_TYPE_FILTERS,
  PAYABLE_COST_TYPE_FILTER_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  STATUS_LABELS,
} from "@/features/finance/labels";
import { resolvePeriod, todayISO } from "@/features/finance/period";
import { getFinanceOptions, listPayables, listReceivables } from "@/features/finance/queries";
import { PAYABLE_STATUSES, RECEIVABLE_STATUSES } from "@/features/finance/types";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { generateFinanceAutoPautasAction } from "@/features/finance/actions";

export const metadata: Metadata = { title: "Financeiro" };

type SearchParams = Promise<Record<string, string | undefined>>;

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "recebimentos", label: "Recebimentos" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "por-cliente", label: "Por cliente" },
  { key: "em-negociacao", label: "Em negociação" },
  { key: "fluxo-de-caixa", label: "Fluxo de caixa" },
  { key: "custos-da-empresa", label: "Custos da empresa" },
] as const;

function splitParam(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  // O middleware já barra; esta checagem impede qualquer consulta financeira sem a capability.
  if (!hasCapability(profile, "finance")) redirect("/inicio");

  const params = await searchParams;
  const today = todayISO();
  // Reforço do cron: gera as pautas automáticas do financeiro (idempotente) sem bloquear a página.
  void generateFinanceAutoPautasAction();
  const period = resolvePeriod(params.periodo, params.de, params.ate, today);
  const tab = TABS.find((item) => item.key === params.aba)?.key ?? "dashboard";

  const options = await getFinanceOptions();

  const periodParams = new URLSearchParams();
  if (params.periodo) periodParams.set("periodo", params.periodo);
  if (params.de) periodParams.set("de", params.de);
  if (params.ate) periodParams.set("ate", params.ate);
  const tabHref = (key: string) => {
    const query = new URLSearchParams(periodParams);
    query.set("aba", key);
    return `/financeiro?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        panel="/financeiro"
        title="Financeiro."
        description="Painel, recebimentos, pagamentos, clientes, fluxo de caixa e custos da empresa."
        actions={
          <div className="flex flex-wrap gap-2">
            <ReceivableDialog mode="create" options={options} today={today} />
            <PayableDialog mode="create" options={options} today={today} />
          </div>
        }
      />

      <div className="space-y-6">
        {tab === "custos-da-empresa" ? null : (
          <Suspense>
            <PeriodSelector period={period} />
          </Suspense>
        )}
        <LinkTabs label="Seções do financeiro" tabs={TABS.map((item) => ({ href: tabHref(item.key), label: item.label, active: item.key === tab }))} />

        {tab === "dashboard" ? (
          <DashboardTab period={period} />
        ) : tab === "recebimentos" ? (
          <ReceivablesTab params={params} period={period} options={options} today={today} />
        ) : tab === "pagamentos" ? (
          <PayablesTab params={params} period={period} options={options} today={today} />
        ) : tab === "por-cliente" ? (
          <ByClientTab />
        ) : tab === "em-negociacao" ? (
          <NegotiationTab canEditProbabilities={hasCapability(profile, "crmOverview")} />
        ) : tab === "fluxo-de-caixa" ? (
          <CashFlowTab />
        ) : (
          <CompanyCostsTab filters={parseCompanyCostFilters(params, today.slice(0, 7))} options={options} />
        )}
      </div>
    </>
  );
}

interface TabProps {
  params: Record<string, string | undefined>;
  period: ReturnType<typeof resolvePeriod>;
  options: Awaited<ReturnType<typeof getFinanceOptions>>;
  today: string;
}

async function ReceivablesTab({ params, period, options, today }: TabProps) {
  const status = splitParam(params.status);
  const rows = await listReceivables({
    period,
    status,
    companyId: splitParam(params.cliente),
    projectId: splitParam(params.projeto),
    method: splitParam(params.metodo),
    search: params.busca,
  });

  return (
    <div className="space-y-4">
      <Suspense>
        <FiltersPopover
          groups={[
            { key: "status", label: "Status", options: RECEIVABLE_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })) },
            { key: "cliente", label: "Cliente", options: options.companies.map((item) => ({ value: item.id, label: item.name })) },
            { key: "projeto", label: "Projeto", options: options.projects.map((item) => ({ value: item.id, label: item.name })) },
            { key: "metodo", label: "Forma de pagamento", options: PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })) },
          ]}
          search={{ key: "busca", label: "Buscar por descrição" }}
        />
      </Suspense>
      {status.length === 1 && status[0] === "atrasado" ? (
        <p className="text-[13px] text-muted-foreground">Atrasados aparecem de qualquer período.</p>
      ) : null}
      <ReceivablesTable rows={rows} options={options} today={today} />
    </div>
  );
}

async function PayablesTab({ params, period, options, today }: TabProps) {
  const status = splitParam(params.status);
  const fixedParam = splitParam(params.fixo);
  const costType = splitParam(params.tipoCusto);
  const rows = await listPayables({
    period,
    status,
    category: splitParam(params.categoria),
    projectId: splitParam(params.projeto),
    companyId: splitParam(params.cliente),
    method: splitParam(params.metodo),
    isFixed: fixedParam.length === 1 ? [fixedParam[0] === "fixo"] : undefined,
    costType,
    payee: params.favorecido,
    search: params.busca,
  });

  // Atalho: mesmo efeito de marcar só "Custos fixos da empresa" no popover, um clique.
  const presetParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "tipoCusto") presetParams.set(key, value);
  }
  presetParams.set("tipoCusto", "fixo_empresa");
  const isPresetActive = costType.length === 1 && costType[0] === "fixo_empresa";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Suspense>
          <FiltersPopover
            groups={[
              { key: "status", label: "Status", options: PAYABLE_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })) },
              { key: "cliente", label: "Cliente", options: options.companies.map((item) => ({ value: item.id, label: item.name })) },
              { key: "projeto", label: "Projeto", options: options.projects.map((item) => ({ value: item.id, label: item.name })) },
              { key: "categoria", label: "Categoria", options: PAYABLE_CATEGORIES.map((value) => ({ value, label: PAYABLE_CATEGORY_LABELS[value] })) },
              { key: "metodo", label: "Forma de pagamento", options: PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })) },
              { key: "fixo", label: "Fixo ou variável", options: [{ value: "fixo", label: FIXED_VARIABLE_LABELS.fixed }, { value: "variavel", label: FIXED_VARIABLE_LABELS.variable }] },
              {
                key: "tipoCusto",
                label: "Tipo de custo",
                options: PAYABLE_COST_TYPE_FILTERS.map((value) => ({ value, label: PAYABLE_COST_TYPE_FILTER_LABELS[value] })),
              },
            ]}
            search={{ key: "busca", label: "Buscar por descrição ou favorecido" }}
          />
        </Suspense>
        <Link
          href={`/financeiro?${presetParams.toString()}`}
          className={cn(
            "inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold transition-colors",
            isPresetActive ? "border-foreground bg-foreground text-background" : "border-border-strong text-foreground hover:bg-surface-hover",
          )}
        >
          Só custos fixos da empresa
        </Link>
      </div>
      {status.length === 1 && status[0] === "atrasado" ? (
        <p className="text-[13px] text-muted-foreground">Atrasados aparecem de qualquer período.</p>
      ) : null}
      <PayablesTable rows={rows} options={options} today={today} initialOpenId={params.pagamento} />
    </div>
  );
}
