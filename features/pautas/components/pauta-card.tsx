"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { PautaPriorityBadge } from "@/features/pautas/components/pauta-priority-badge";
import { PautaStatusBadge } from "@/features/pautas/components/pauta-status-badge";
import { isPautaOverdue } from "@/lib/pautas";
import { formatDate } from "@/lib/format";
import { toneGradient, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { PautaWithDetails } from "@/types";

interface PautaCardProps {
  pauta: PautaWithDetails;
  onOpen: () => void;
  dragging?: boolean;
  /** Degradê levíssimo na cor do squad de origem (Minhas Pautas, para quem está em mais de um squad). */
  tint?: StatusTone;
}

export function PautaCard({ pauta, onOpen, dragging = false, tint }: PautaCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: pauta.id! });
  const overdue = pauta.due_date ? isPautaOverdue(pauta.due_date, pauta.board_column!) : false;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        backgroundImage: tint ? toneGradient(tint) : undefined,
      }}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-grab space-y-2.5 rounded-md border border-border bg-card p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing",
        (isDragging || dragging) && "opacity-50",
      )}
    >
      <div className="space-y-0.5">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-subtle">
          <ClientAvatar
            name={pauta.project_is_internal || !pauta.company_name ? "Além Filmes" : pauta.company_name}
            logoUrl={pauta.project_is_internal ? null : pauta.company_logo_url}
            size="sm"
            className="size-5"
          />
          <span className="truncate">{pauta.project_is_internal ? "Interno — Além Filmes" : (pauta.company_name ?? "—")}</span>
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{pauta.title}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PautaStatusBadge status={pauta.status!} />
        <PautaPriorityBadge priority={pauta.priority!} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex -space-x-1.5">
          {pauta.lead_id ? <UserAvatar name={pauta.lead_name ?? "—"} src={pauta.lead_avatar_url} className="size-6 border-2 border-card" /> : null}
          {pauta.current_assignee_id && pauta.current_assignee_id !== pauta.lead_id ? (
            <UserAvatar name={pauta.assignee_name ?? "—"} src={pauta.assignee_avatar_url} className="size-6 border-2 border-card" />
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          {pauta.comments_count ? (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="size-3" aria-hidden />
              {pauta.comments_count}
            </span>
          ) : null}
          {pauta.due_date ? (
            <span className={cn("flex items-center gap-1 font-semibold", overdue && "text-foreground")}>
              {overdue ? <AlertTriangle className="size-3" aria-hidden /> : null}
              {overdue ? "Atrasado" : formatDate(pauta.due_date)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
