"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { UserAvatar, usePrimarySquad } from "@/components/ui/avatar";
import { StatusDot } from "@/components/ui/status-dot";
import { Badge } from "@/components/ui/badge";
import { PautaPriorityBadge } from "@/features/pautas/components/pauta-priority-badge";
import { ClientWaitingBadge, FreelancerBadge } from "@/features/pautas/components/freelancer-badge";
import { PautaStatusBadge } from "@/features/pautas/components/pauta-status-badge";
import { isPautaOverdue } from "@/lib/pautas";
import { formatDate } from "@/lib/format";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import { SURFACE, squadBarStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { PautaWithDetails } from "@/types";

interface MyPautaRowProps {
  pauta: PautaWithDetails;
  currentUserId: string;
  onOpen: () => void;
  muted?: boolean;
  showSquad?: boolean;
}

export function MyPautaRow({ pauta, currentUserId, onOpen, muted = false, showSquad = false }: MyPautaRowProps) {
  const overdue = pauta.due_date ? isPautaOverdue(pauta.due_date, pauta.board_column!) : false;
  const showAssignee = pauta.current_assignee_id !== null && pauta.current_assignee_id !== currentUserId;
  const ownerSquad = usePrimarySquad(pauta.lead_id ?? pauta.created_by) ?? pauta.squad;

  return (
    <div
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
        SURFACE.card,
        "relative flex flex-wrap items-center gap-3 overflow-hidden rounded-md py-3 pl-5 pr-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        muted && "opacity-70",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={squadBarStyle(ownerSquad)} />
      <ClientAvatar
        name={pauta.is_standalone || pauta.project_is_internal || !pauta.company_name ? "Além Filmes" : pauta.company_name}
        logoUrl={pauta.is_standalone || pauta.project_is_internal ? null : pauta.company_logo_url}
        size="md"
      />
      <div className="min-w-0 flex-1 basis-56 space-y-0.5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-snug">
          {showSquad && pauta.squad ? <StatusDot tone={SQUAD_TONE[pauta.squad]} label={SQUAD_LABELS[pauta.squad]} /> : null}
          <span className="truncate">{pauta.title}</span>
        </p>
        <p className="truncate text-[12px] text-subtle">
          {pauta.is_standalone && pauta.deal_id ? (
            <Link
              href={`/crm?aba=leads&negocio=${pauta.deal_id}`}
              onClick={(event) => event.stopPropagation()}
              className="hover:text-foreground hover:underline"
            >
              Abrir o negócio no CRM
            </Link>
          ) : pauta.is_standalone ? (
            <Badge variant="muted" className="px-1.5 py-0">
              Avulsa
            </Badge>
          ) : (
            <>
              {pauta.project_is_internal || !pauta.company_id ? (
                <span>Interno</span>
              ) : (
                <Link
                  href={`/clientes/${pauta.company_id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="hover:text-foreground hover:underline"
                >
                  {pauta.company_name ?? "—"}
                </Link>
              )}
              {pauta.project_id ? (
                <>
                  {" · "}
                  <Link
                    href={`/projetos/${pauta.project_id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="hover:text-foreground hover:underline"
                  >
                    {pauta.project_name}
                  </Link>
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {pauta.status ? <PautaStatusBadge status={pauta.status} /> : null}
        {pauta.priority ? <PautaPriorityBadge priority={pauta.priority} /> : null}
        {pauta.freelancer_name ? <FreelancerBadge name={pauta.freelancer_name} /> : null}
        {pauta.waiting_on_contact_name ? <ClientWaitingBadge name={pauta.waiting_on_contact_name} role={pauta.waiting_on_contact_role} /> : null}
      </div>

      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {pauta.due_date ? (
          <span className={cn("flex items-center gap-1 font-semibold", overdue && "text-foreground")}>
            {overdue ? <AlertTriangle className="size-3" aria-hidden /> : null}
            {overdue ? "Atrasado" : formatDate(pauta.due_date)}
          </span>
        ) : (
          <span className="text-subtle">Sem prazo</span>
        )}
      </div>

      {showAssignee ? <UserAvatar name={pauta.assignee_name ?? "—"} src={pauta.assignee_avatar_url} profileId={pauta.current_assignee_id} className="size-6" /> : null}
    </div>
  );
}
