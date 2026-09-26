"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Flame, MessageCircle, MessageSquareReply } from "lucide-react";
import { UserAvatar, usePrimarySquad } from "@/components/ui/avatar";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { StatusDot } from "@/components/ui/status-dot";
import { isDealOverdue } from "@/features/crm/board";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { TEMPERATURE_LABELS, type Temperature } from "@/features/crm/labels";
import { formatCents, toCents } from "@/features/finance/money";
import { formatDate } from "@/lib/format";
import { TEMPERATURE_TONE } from "@/lib/status";
import { SURFACE, squadBarStyle, squadGradient } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { DealWithDetails } from "@/types";

interface DealCardProps {
  deal: DealWithDetails;
  dragging?: boolean;
}

function percentLabel(value: number) {
  return String(value).replace(".", ",").replace(/,00$/, "");
}

/** O card mostra o essencial; toda a rotina (registrar contato, resposta, reaquecimento) está a um clique. */
export function DealCard({ deal, dragging = false }: DealCardProps) {
  const flow = useCrmFlow();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id! });
  const overdue = isDealOverdue(deal.next_action_at);
  const temperature = (deal.temperature ?? "neutral") as Temperature;
  const open = deal.stage !== "ganho" && deal.stage !== "perdido";
  const isOwner = deal.owner_id === flow.currentUserId;
  const reason = deal.temperature_reason ?? TEMPERATURE_LABELS[temperature];
  const withBall = deal.responsible_id && deal.responsible_id !== deal.owner_id;

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  // Degradê na cor do squad de quem está com a bola agora; barra na cor do dono (SDR).
  const responsibleSquad = usePrimarySquad(deal.responsible_id ?? deal.owner_id);
  const ownerSquad = usePrimarySquad(deal.owner_id);
  const gradient = squadGradient(responsibleSquad);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        backgroundImage: gradient ? `${gradient}, linear-gradient(180deg, var(--surface-card-from), var(--surface-card-to))` : undefined,
      }}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={() => flow.openDeal(deal.id!)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          flow.openDeal(deal.id!);
        }
      }}
      className={cn(
        SURFACE.card,
        "relative cursor-grab space-y-2.5 overflow-hidden rounded-md p-3.5 pl-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing",
        (isDragging || dragging) && "opacity-50",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={squadBarStyle(ownerSquad)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-subtle">
            <ClientAvatar name={deal.company_name ?? "—"} logoUrl={deal.company_logo_url} size="sm" className="size-5" />
            <span className="truncate">{deal.company_name}</span>
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{deal.title}</p>
        </div>
        {open ? (
          <span className="mt-1 shrink-0" title={reason}>
            <StatusDot tone={TEMPERATURE_TONE[temperature]} label={reason} />
          </span>
        ) : null}
      </div>

      {deal.estimated_value != null ? <p className="text-sm font-bold">{formatCents(toCents(deal.estimated_value))}</p> : null}
      {deal.commission_amount != null && deal.commission_percent != null && deal.stage !== "perdido" ? (
        <p className="text-[12px] font-semibold text-muted-foreground">
          {isOwner ? "Sua comissão" : "Comissão"}: {formatCents(toCents(deal.commission_amount))} ({percentLabel(deal.commission_percent)}%)
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex -space-x-1.5">
          <span title={`SDR: ${deal.owner_name ?? "—"}`}>
            <UserAvatar name={deal.owner_name ?? "—"} src={deal.owner_avatar_url} profileId={deal.owner_id} className="size-6" />
          </span>
          {withBall ? (
            <span title={`Com a bola: ${deal.responsible_name ?? "—"}`}>
              <UserAvatar name={deal.responsible_name ?? "—"} src={deal.responsible_avatar_url} profileId={deal.responsible_id} className="size-6" />
            </span>
          ) : null}
        </div>
        <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
          {deal.is_reheated ? <Flame className="size-3" aria-label="Reaquecido" /> : null}
          {deal.days_in_stage} {deal.days_in_stage === 1 ? "dia" : "dias"} na etapa
        </span>
      </div>

      {open ? (
        deal.next_action ? (
          <p className={cn("flex items-center gap-1 text-[12px] font-semibold", overdue ? "text-foreground" : "text-muted-foreground")}>
            {overdue ? <AlertTriangle className="size-3 shrink-0" aria-hidden /> : null}
            <span className="truncate">{deal.next_action}</span>
            {deal.next_action_at ? <span className="shrink-0">· {formatDate(deal.next_action_at)}</span> : null}
          </p>
        ) : (
          <p className="text-[12px] font-semibold text-subtle">Sem próxima ação</p>
        )
      ) : null}

      {open ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5" onPointerDown={stop}>
          <button
            type="button"
            onClick={(event) => {
              stop(event);
              flow.logContact(deal);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong px-2 text-[12px] font-semibold transition-colors hover:bg-surface-hover"
          >
            <MessageCircle className="size-3" aria-hidden />+ Registrar contato
          </button>
          <button
            type="button"
            onClick={(event) => {
              stop(event);
              flow.clientResponded(deal);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong px-2 text-[12px] font-semibold transition-colors hover:bg-surface-hover"
          >
            <MessageSquareReply className="size-3" aria-hidden />
            Cliente respondeu
          </button>
        </div>
      ) : deal.can_reheat && (isOwner || flow.canManageAll) ? (
        <div className="border-t border-border pt-2.5" onPointerDown={stop}>
          <button
            type="button"
            onClick={(event) => {
              stop(event);
              flow.reheat(deal);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong px-2 text-[12px] font-semibold transition-colors hover:bg-surface-hover"
          >
            <Flame className="size-3" aria-hidden />
            Definir reaquecimento
          </button>
        </div>
      ) : null}
    </div>
  );
}
