import { Money } from "@/components/ui/money";
import { Suspense } from "react";
import { Building, Code2, Layers, Megaphone, Percent, Receipt, Shapes, Users, Wallet, type LucideIcon } from "lucide-react";
import { FilterPopover } from "@/components/filters/filter-popover";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardIcon, CardTitle } from "@/components/ui/card";
import { Metric, MetricGrid, MetricValue } from "@/components/ui/metric-value";
import { CompanyCostsChart } from "@/features/finance/components/charts/company-costs-chart";
import { EmptyState } from "@/features/finance/components/table-shell";
import { getCompanyCosts, type CompanyCostFilters } from "@/features/finance/company-costs";
import {
  COMPANY_COST_GROUP_LABELS,
  FIXED_VARIABLE_LABELS,
  PAYABLE_CATEGORIES,
  PAYABLE_CATEGORY_LABELS,
  type CompanyCostGroup,
} from "@/features/finance/labels";
import { formatCents } from "@/features/finance/money";
import type { FinanceOptions } from "@/features/finance/types";
import { MonthSelector } from "@/features/time-tracking/components/month-selector";
import { formatDate } from "@/lib/format";

const GROUP_ICON: Record<CompanyCostGroup, LucideIcon> = {
  equipe: Users,
  software: Code2,
  estrutura: Building,
  impostos: Receipt,
  marketing: Megaphone,
  outros: Shapes,
};

/** Tom do % de faturamento consumido pelos custos fixos (quanto menor, melhor). */
function shareTone(share: number | null) {
  if (share == null) return undefined;
  if (share <= 30) return "success" as const;
  if (share <= 50) return "warning" as const;
  return "danger" as const;
}

/**
 * Aba "Custos da empresa": o que a Além custa para funcionar (pagamentos com cost_scope 'empresa'),
 * agrupado por categoria, com evolução em 12 meses, comparação com o faturamento e custo mensal
 * por pessoa (pagamentos ligados a um colaborador). Só para quem tem acesso ao financeiro.
 */
export async function CompanyCostsTab({ filters, options }: { filters: CompanyCostFilters; options: FinanceOptions }) {
  const data = await getCompanyCosts(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <MonthSelector yearMonth={data.month} />
          <FilterPopover
            sections={[
              { key: "categoria", label: "Categoria", options: PAYABLE_CATEGORIES.map((value) => ({ value, label: PAYABLE_CATEGORY_LABELS[value] })) },
              { key: "pessoa", label: "Pessoa", options: options.members.map((member) => ({ value: member.id, label: member.full_name })) },
              {
                key: "fixo",
                label: "Fixo ou variável",
                options: [
                  { value: "fixo", label: FIXED_VARIABLE_LABELS.fixed },
                  { value: "variavel", label: FIXED_VARIABLE_LABELS.variable },
                ],
              },
            ]}
          />
        </Suspense>
      </div>

      <MetricGrid min="12rem">
        <Card className="p-5">
          <Metric label="Total do mês" icon={Wallet} value={data.total} format="cents" size="lg" />
        </Card>
        <Card className="p-5">
          <Metric label="Custos fixos" icon={Layers} value={data.fixedTotal} format="cents" size="lg" />
        </Card>
        <Card className="p-5">
          <Metric label="Custos variáveis" icon={Shapes} value={data.variableTotal} format="cents" size="lg" />
        </Card>
        <Card className="p-5">
          <Metric
            label="Faturamento consumido pelos fixos"
            icon={Percent}
            value={data.fixedShare}
            format="percent"
            size="lg"
            tone={shareTone(data.fixedShare)}
            note={
              <>
                Faturamento do mês: <Money cents={data.revenue} />
              </>
            }
          />
        </Card>
      </MetricGrid>

      <section aria-labelledby="grupos-title" className="space-y-3">
        <h2 id="grupos-title" className="section-title">
          Por categoria
        </h2>
        <div className="card-grid">
          {data.groups.map((group) => (
            <Card key={group.group} className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <CardIcon icon={GROUP_ICON[group.group]} tone="success" />
                <p className="text-sm font-bold">{COMPANY_COST_GROUP_LABELS[group.group]}</p>
              </div>
              <MetricValue value={group.total} format="cents" size="md" />
              <p className="text-xs text-subtle">
                Fixo <Money cents={group.fixed} /> · Variável <Money cents={group.variable} />
              </p>
            </Card>
          ))}
        </div>
      </section>

      <CompanyCostsChart data={data.evolution} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <CardIcon icon={Users} tone="success" />
            <CardTitle>Custo mensal por pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            {data.people.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum custo ligado a um colaborador neste mês. Ao lançar um custo de Pessoal/Equipe, escolha a pessoa em “Favorecido”.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.people.map((person) => (
                  <li key={person.profileId} className="flex items-center gap-3 py-2.5">
                    <UserAvatar name={person.name} src={person.avatarUrl} profileId={person.profileId} className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.name}</span>
                    <span className="whitespace-nowrap text-sm font-bold tabular-nums"><Money cents={person.total} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <CardIcon icon={Receipt} tone="success" />
            <CardTitle>Lançamentos do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lines.length === 0 ? (
              <EmptyState icon={Layers} title="Nenhum custo da empresa neste mês." hint="Custos sem projeto aparecem aqui." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-subtle">
                      <th className="py-2 pr-3 font-semibold">Descrição</th>
                      <th className="py-2 pr-3 font-semibold">Categoria</th>
                      <th className="py-2 pr-3 font-semibold">Vencimento</th>
                      <th className="py-2 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="max-w-[16rem] py-2.5 pr-3">
                          <p className="truncate font-semibold">{line.description}</p>
                          {line.payeeLabel ? <p className="truncate text-xs text-subtle">{line.payeeLabel}</p> : null}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="flex flex-wrap gap-1">
                            <Badge variant="muted">{PAYABLE_CATEGORY_LABELS[line.category]}</Badge>
                            <Badge variant="outline">{line.isFixed ? FIXED_VARIABLE_LABELS.fixed : FIXED_VARIABLE_LABELS.variable}</Badge>
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{formatDate(line.dueDate)}</td>
                        <td data-sensitive className="whitespace-nowrap py-2.5 text-right font-bold tabular-nums">{formatCents(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
