"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { getPautaDealSummaryAction, type PautaDealSummary } from "@/features/pautas/actions";
import { CRM_LOCK_MESSAGE, crmDealHref } from "@/features/pautas/crm-lock";
import { ChannelIcon } from "@/features/crm/components/channel-icon";
import { DealStageBadge } from "@/features/crm/components/deal-stage-badge";
import { INTERACTION_CHANNEL_LABELS, INTERACTION_KIND_LABELS } from "@/features/crm/labels";
import { toCents } from "@/features/finance/money";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

/** A pauta espelho mostra o negócio: etapa, próxima ação, última interação e (com acesso) o valor. */
export function PautaDealTab({ pautaId, dealId }: { pautaId: string; dealId: string }) {
  const [summary, setSummary] = useState<PautaDealSummary | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getPautaDealSummaryAction(pautaId).then((data) => {
      if (active) setSummary(data);
    });
    return () => {
      active = false;
    };
  }, [pautaId]);

  if (summary === undefined) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando negócio">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-raised p-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          {CRM_LOCK_MESSAGE}: registre contatos e mude a etapa por lá.
        </p>
        {summary?.can_open_deal !== false ? (
          <Button asChild size="sm">
            <Link href={crmDealHref(dealId)}>
              Abrir no CRM
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>

      {!summary ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o negócio.</p>
      ) : (
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="eyebrow">Etapa</dt>
            <dd className="mt-1.5">
              <DealStageBadge stage={summary.stage} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Negócio</dt>
            <dd className="mt-1 font-semibold">
              {summary.code ? `${summary.code} · ` : ""}
              {summary.title}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">SDR (dono)</dt>
            <dd className="mt-1 font-semibold">{summary.owner_name}</dd>
          </div>
          <div>
            <dt className="eyebrow">Com a bola agora</dt>
            <dd className="mt-1 font-semibold">{summary.responsible_name ?? "Ninguém"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="eyebrow">Próxima ação</dt>
            <dd className="mt-1 font-semibold">
              {summary.next_action ?? "—"}
              {summary.next_action_at ? <span className="font-normal text-muted-foreground"> · {formatDateTime(summary.next_action_at)}</span> : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="eyebrow">Última interação</dt>
            <dd className="mt-1">
              {summary.last_interaction_at ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <ChannelIcon channel={summary.last_interaction_channel} />
                  <span className="font-semibold">
                    {summary.last_interaction_channel ? INTERACTION_CHANNEL_LABELS[summary.last_interaction_channel] : INTERACTION_KIND_LABELS[summary.last_interaction_kind]}
                  </span>
                  <span className="text-muted-foreground">· {formatDateTime(summary.last_interaction_at)}</span>
                  <span className="basis-full text-muted-foreground">{summary.last_interaction_text}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Nenhum contato registrado.</span>
              )}
              <span className="mt-1 block text-[12px] text-subtle">{summary.interactions_count} interações no histórico</span>
            </dd>
          </div>
          {summary.negotiation_value != null ? (
            <div>
              <dt className="eyebrow">Valor em negociação</dt>
              <dd className="mt-1 font-bold">
                <Money cents={toCents(summary.negotiation_value)} />
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}
