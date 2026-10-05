"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Archive, MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar, usePrimarySquad } from "@/components/ui/avatar";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { PautaPriorityBadge } from "@/features/pautas/components/pauta-priority-badge";
import { ClientWaitingBadge, FreelancerBadge } from "@/features/pautas/components/freelancer-badge";
import { PautaStatusBadge } from "@/features/pautas/components/pauta-status-badge";
import { isPautaOverdue } from "@/lib/pautas";
import { formatDate } from "@/lib/format";
import { SURFACE, squadBarStyle, squadGradient } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { PautaWithDetails } from "@/types";
import { NfseChip } from "@/features/finance/components/invoice-controls";
import { isInvoiceTaskTitle } from "@/lib/links";

export type PautaCardMenu = { canDelete: boolean; canArchive: boolean; onRemove: (mode: "delete" | "archive") => void };

interface PautaCardProps {
  pauta: PautaWithDetails;
  onOpen: () => void;
  dragging?: boolean;
  /** Menu de contexto (botão "⋯" e clique direito): arquivar e, para quem criou, apagar. */
  menu?: PautaCardMenu;
}

/**
 * Card de pauta (quadro global, aba do projeto e Minhas Pautas). Degradê da esquerda para a direita
 * na cor do squad principal do RESPONSÁVEL atual — quem está em vários squads reconhece a origem na
 * hora — e barra lateral de 3px na cor do squad de quem atribuiu/é dono (o líder). Sem squad
 * conhecido, superfície neutra.
 */
export function PautaCard({ pauta, onOpen, dragging = false, menu }: PautaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = Boolean(menu && (menu.canDelete || menu.canArchive));
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: pauta.id! });
  const overdue = pauta.due_date ? isPautaOverdue(pauta.due_date, pauta.board_column!) : false;
  const assigneeSquad = usePrimarySquad(pauta.current_assignee_id ?? pauta.lead_id) ?? pauta.squad;
  const ownerSquad = usePrimarySquad(pauta.lead_id ?? pauta.created_by) ?? pauta.squad;
  const gradient = squadGradient(assigneeSquad);

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
      onClick={onOpen}
      onContextMenu={(event) => {
        if (!hasMenu) return;
        event.preventDefault();
        setMenuOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        SURFACE.card,
        "relative cursor-grab space-y-2.5 overflow-hidden rounded-md p-3.5 pl-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing",
        (isDragging || dragging) && "opacity-50",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={squadBarStyle(ownerSquad)} />
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
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{pauta.title}</p>
          {hasMenu && menu ? (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                aria-label={`Ações da pauta ${pauta.title}`}
                className="-mr-1 -mt-0.5 shrink-0 rounded-sm p-0.5 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem onSelect={onOpen}>Abrir</DropdownMenuItem>
                {menu.canArchive ? (
                  <DropdownMenuItem onSelect={() => menu.onRemove("archive")}>
                    <Archive aria-hidden />
                    Arquivar
                  </DropdownMenuItem>
                ) : null}
                {menu.canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => menu.onRemove("delete")}>
                      <Trash2 aria-hidden />
                      Apagar pauta
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PautaStatusBadge status={pauta.status!} squad={pauta.squad} />
        <PautaPriorityBadge priority={pauta.priority!} />
        {pauta.freelancer_name ? <FreelancerBadge name={pauta.freelancer_name} /> : null}
        {pauta.waiting_on_contact_name ? <ClientWaitingBadge name={pauta.waiting_on_contact_name} role={pauta.waiting_on_contact_role} /> : null}
        {pauta.source === "auto_financeiro" ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground" title="Criada pelo sistema a partir dos dados do financeiro">
            Automática
          </span>
        ) : null}
        {pauta.title && isInvoiceTaskTitle(pauta.title) ? <NfseChip /> : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex -space-x-1 pl-0.5">
          {pauta.lead_id ? <UserAvatar name={pauta.lead_name ?? "—"} src={pauta.lead_avatar_url} profileId={pauta.lead_id} className="size-6" /> : null}
          {pauta.current_assignee_id && pauta.current_assignee_id !== pauta.lead_id ? (
            <UserAvatar name={pauta.assignee_name ?? "—"} src={pauta.assignee_avatar_url} profileId={pauta.current_assignee_id} className="size-6" />
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
