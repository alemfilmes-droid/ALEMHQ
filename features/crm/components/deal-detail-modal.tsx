"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Flame, MessageCircle, MessageSquareReply } from "lucide-react";
import { getDealDetailAction } from "@/features/crm/actions";
import { ClosingSection } from "@/features/crm/components/detail/closing-section";
import { DealFieldsForm } from "@/features/crm/components/detail/deal-fields-form";
import { DirectionSection } from "@/features/crm/components/detail/direction-section";
import { InteractionsTimeline } from "@/features/crm/components/detail/interactions-timeline";
import { MeetingsSection } from "@/features/crm/components/detail/meetings-section";
import { NextActionCard } from "@/features/crm/components/detail/next-action-card";
import { ProposalsSection } from "@/features/crm/components/detail/proposals-section";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { QualificationForm } from "@/features/crm/components/qualification-form";
import { DEAL_STAGES, DEAL_STAGE_LABELS, TEMPERATURE_LABELS, type Temperature } from "@/features/crm/labels";
import type { DealDetail, DealFormOptions } from "@/features/crm/types";
import { formatCents, toCents } from "@/features/finance/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { formatDate, formatDateTime } from "@/lib/format";
import { TEMPERATURE_TONE } from "@/lib/status";
import type { DealStage } from "@/types";

interface DealDetailModalProps {
  dealId: string;
  options: DealFormOptions;
  canManageAll: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailModal({ dealId, options, canManageAll, open, onOpenChange }: DealDetailModalProps) {
  const flow = useCrmFlow();
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getDealDetailAction(dealId).then((data) => {
      setDetail(data);
      setLoading(false);
    });
  }, [dealId]);

  // Recarrega ao abrir e a cada fluxo concluído (flow.version).
  useEffect(() => {
    load();
  }, [load, flow.version]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] max-w-3xl flex-col">
        {loading || !detail ? (
          <div className="space-y-4" role="status" aria-label="Carregando negócio">
            <DialogHeader>
              <DialogTitle className="sr-only">Carregando negócio</DialogTitle>
            </DialogHeader>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <DealDetailBody detail={detail} options={options} canManageAll={canManageAll} reload={load} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-border pt-5">
      <h3 id={id} className="section-title">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DealDetailBody({ detail, options, canManageAll, reload }: { detail: DealDetail; options: DealFormOptions; canManageAll: boolean; reload: () => void }) {
  const flow = useCrmFlow();
  const { deal, qualification, interactions, meetings, proposals, negotiations, log } = detail;
  const stage = deal.stage!;
  const closed = stage === "ganho" || stage === "perdido";
  const isOwner = deal.owner_id === flow.currentUserId;
  const temperature = (deal.temperature ?? "neutral") as Temperature;
  const canDirect = canManageAll && !closed && deal.is_qualified === true;

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
      <DialogHeader>
        <p className="eyebrow flex flex-wrap items-center gap-2">
          {deal.code}
          <Link href={`/clientes/${deal.company_id}`} className="underline underline-offset-4 hover:text-foreground">
            {deal.company_name}
          </Link>
        </p>
        <DialogTitle>{deal.title}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          aria-label="Etapa do negócio"
          className="w-60"
          value={stage}
          onChange={(event) => flow.requestStage(deal, event.target.value as DealStage)}
        >
          {DEAL_STAGES.map((item) => (
            <option key={item} value={item}>
              {DEAL_STAGE_LABELS[item]}
            </option>
          ))}
        </NativeSelect>
        {deal.is_qualified ? (
          <Badge variant="outline">
            <CheckCircle2 className="size-3" aria-hidden />
            Qualificado
          </Badge>
        ) : null}
        {!closed ? (
          <Badge variant="muted">
            <StatusDot tone={TEMPERATURE_TONE[temperature]} />
            {TEMPERATURE_LABELS[temperature]}
            {deal.temperature_reason && temperature !== "neutral" ? ` · ${deal.temperature_reason}` : ""}
          </Badge>
        ) : null}
        {deal.is_reheated ? (
          <Badge variant="muted">
            <Flame className="size-3" aria-hidden />
            Reaquecido
          </Badge>
        ) : null}
        {deal.fast_track ? <Badge variant="muted">Venda direta</Badge> : null}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="eyebrow">SDR (comissão)</dt>
          <dd className="mt-1 font-semibold">{deal.owner_name}</dd>
        </div>
        <div>
          <dt className="eyebrow">Com a bola agora</dt>
          <dd className="mt-1 font-semibold">{deal.responsible_name ?? "Ninguém"}</dd>
        </div>
        {deal.commission_amount != null && deal.commission_percent != null && stage !== "perdido" ? (
          <div>
            <dt className="eyebrow">{isOwner ? "Sua comissão" : "Comissão do SDR"}</dt>
            <dd className="mt-1 font-semibold">
              {formatCents(toCents(deal.commission_amount))} ({String(deal.commission_percent).replace(".", ",").replace(/,00$/, "")}%)
            </dd>
          </div>
        ) : null}
      </dl>

      {!closed ? <NextActionCard deal={deal} onSaved={reload} /> : null}
      {!closed && deal.next_action_overdue ? (
        <p className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          A próxima ação venceu em {deal.next_action_at ? formatDateTime(deal.next_action_at) : "—"}.
        </p>
      ) : null}

      <DealFieldsForm deal={deal} options={options} canManageAll={canManageAll} onSaved={reload} />

      <Section id="qualificacao-title" title="Qualificação">
        <QualificationForm dealId={deal.id!} qualification={qualification} onSaved={reload} />
      </Section>

      {canDirect ? (
        <Section id="direcionamento-title" title="Direcionamento">
          <DirectionSection deal={deal} onSaved={reload} />
        </Section>
      ) : null}

      <Section id="interacoes-title" title="Contatos">
        {!closed ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => flow.logContact(deal)}>
              <MessageCircle aria-hidden />
              Registrar contato
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => flow.clientResponded(deal)}>
              <MessageSquareReply aria-hidden />
              Cliente respondeu
            </Button>
          </div>
        ) : null}
        <InteractionsTimeline interactions={interactions} />
      </Section>

      <Section id="reunioes-title" title="Reuniões">
        <MeetingsSection deal={deal} meetings={meetings} closed={closed} />
      </Section>

      <Section id="propostas-title" title="Propostas e negociação">
        <ProposalsSection deal={deal} proposals={proposals} negotiations={negotiations} closed={closed} />
      </Section>

      <Section id="fechamento-title" title="Fechamento">
        <ClosingSection deal={deal} />
      </Section>

      {log.length > 0 ? (
        <Section id="responsabilidade-title" title="Histórico de responsabilidade">
          <ul className="space-y-1.5 text-[13px] text-muted-foreground">
            {log.map((entry) => (
              <li key={entry.id}>
                {formatDate(entry.occurred_at)} — {entry.body}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
