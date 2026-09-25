"use client";

import { Flame, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { REHEAT_STATUS_LABELS } from "@/features/crm/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { DealWithDetails } from "@/types";

export function ClosingSection({ deal }: { deal: DealWithDetails }) {
  const flow = useCrmFlow();

  if (deal.stage === "ganho") {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4" aria-hidden />
        Negócio ganho{deal.won_at ? ` em ${formatDate(deal.won_at)}` : ""}. Atendimento: {deal.responsible_name ?? "—"}.
      </p>
    );
  }

  if (deal.stage === "perdido") {
    const isOwner = deal.owner_id === flow.currentUserId;
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <XCircle className="size-4" aria-hidden />
          Negócio perdido{deal.lost_at ? ` em ${formatDate(deal.lost_at)}` : ""}.
        </p>
        {deal.reheat_status ? (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <Badge variant="outline">{REHEAT_STATUS_LABELS[deal.reheat_status]}</Badge>
            {deal.reheat_due_at ? <span>Reaquecimento liberado em {formatDate(deal.reheat_due_at)}.</span> : null}
          </p>
        ) : null}
        {deal.can_reheat && (isOwner || flow.canManageAll) ? (
          <Button type="button" onClick={() => flow.reheat(deal)}>
            <Flame aria-hidden />
            Definir reaquecimento
          </Button>
        ) : null}
        {deal.is_reheated ? (
          <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <RotateCcw className="size-3.5" aria-hidden />
            Este lead já foi reaquecido antes.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {flow.canManageAll ? (
        <Button type="button" onClick={() => flow.win(deal)}>
          <Trophy aria-hidden />
          Marcar como ganho
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Peça a um head ou diretor para fechar este negócio como ganho.</p>
      )}
      <Button type="button" variant="secondary" onClick={() => flow.lose(deal)}>
        <XCircle aria-hidden />
        Marcar como perdido
      </Button>
    </div>
  );
}
