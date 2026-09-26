import Link from "next/link";
import { AlertTriangle, CalendarCheck2, Coins, Handshake, TrendingUp, Wallet } from "lucide-react";
import { CARD_LINK_CLASS, CardContent, CardHeading } from "@/components/ui/card";
import { Metric, MetricGrid } from "@/components/ui/metric-value";
import { getDirectorHomeSummary, getMyCommissions, getWorkday } from "@/features/crm/queries";
import type { WorkdayItem } from "@/features/crm/types";
import { formatCents } from "@/features/finance/money";


const CATEGORY_LABELS: Record<WorkdayItem["category"], string> = {
  acao_vencida: "Ações vencidas",
  acao_hoje: "Ações de hoje",
  prospeccao_parada: "Prospecção parada",
  sem_atualizacao: "Sem atualização",
  reaquecer: "Para reaquecer",
  voltou_reuniao: "Voltou de reunião",
};

/** Visão gerencial (diretoria/master): o comercial em números, clicável para o CRM. */
export async function DirectorCommercialCard({ canSeeFinance }: { canSeeFinance: boolean }) {
  const summary = await getDirectorHomeSummary();

  return (
    <Link href="/crm" className={CARD_LINK_CLASS}>
      <CardHeading icon={TrendingUp} tone="alert" title="Comercial" sensitive={canSeeFinance} />
      <CardContent>
        <MetricGrid min="8.5rem">
          {canSeeFinance ? <Metric label="Em negociação" icon={Wallet} value={summary.valueInNegotiation} format="cents" tone="warning" /> : null}
          <Metric label="Propostas aguardando resposta" value={summary.proposalsAwaiting} />
          <Metric label="Reuniões hoje" icon={CalendarCheck2} value={summary.meetingsToday} />
          <Metric
            label="Ganhos no mês"
            icon={Handshake}
            value={summary.wonMonthCount}
            tone="success"
            note={canSeeFinance ? <span data-sensitive>{formatCents(summary.wonMonthValue)}</span> : undefined}
          />
        </MetricGrid>
      </CardContent>
    </Link>
  );
}

/**
 * "Meu dia comercial": o que está com a pessoa agora, por prioridade. Cada linha vai direto para o
 * negócio. SDR/BDR também vê o bloco "Minhas comissões".
 */
export async function MyCommercialDayCard({ profileId, showCommissions }: { profileId: string; showCommissions: boolean }) {
  const [items, commissions] = await Promise.all([getWorkday(profileId), showCommissions ? getMyCommissions(profileId) : Promise.resolve(null)]);
  const visible = items.slice(0, 6);

  return (
    <div className="card-surface card-span-2 flex h-full flex-col rounded-lg">
      <CardHeading icon={AlertTriangle} tone="alert" title="Meu dia comercial" />
      <CardContent className="space-y-5">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pendente com você agora.</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li key={`${item.category}-${item.dealId}`}>
                <Link
                  href={`/crm?aba=leads&negocio=${item.dealId}`}
                  className="block rounded-md border border-border px-3 py-2 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {item.companyName} · {item.title}
                    </span>
                    <span className="eyebrow">{CATEGORY_LABELS[item.category]}</span>
                  </span>
                  <span className="block text-[13px] text-muted-foreground">{item.reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {items.length > visible.length ? (
          <Link href="/crm?aba=leads" className="inline-block text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">
            Ver os outros {items.length - visible.length}
          </Link>
        ) : null}

        {commissions ? (
          <Link href="/crm?aba=leads" className="block space-y-2 border-t border-border pt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Coins className="size-3.5 shrink-0" aria-hidden />
              Minhas comissões
            </p>
            <MetricGrid min="9rem">
              <Metric
                label={`Em negociação (${commissions.potentialCount})`}
                value={commissions.potential}
                format="cents"
                size="sm"
                tone="warning"
              />
              <Metric
                label={`Ganhas no mês (${commissions.confirmedCount})`}
                value={commissions.confirmedMonth}
                format="cents"
                size="sm"
                tone="success"
              />
            </MetricGrid>
          </Link>
        ) : null}
      </CardContent>
    </div>
  );
}
