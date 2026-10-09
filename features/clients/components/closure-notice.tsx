import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { CLOSURE_REASON_LABELS, PROSPECT_POTENTIAL_LABELS, PROSPECT_POTENTIAL_TONE, type ClientClosureInfo } from "@/features/clients/closures";
import { formatDate } from "@/lib/format";

/**
 * Por que o cliente saiu e se vale voltar a abordar — no CRM (negócio e novo negócio) e no cliente.
 * Sem valores: só o motivo, a explicação e o potencial.
 */
export function ClosureNotice({ closure, compact = false }: { closure: ClientClosureInfo; compact?: boolean }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface-raised p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <History className="size-4 text-subtle" aria-hidden />
        {closure.reopenedAt ? "Ex-cliente reativado" : "Ex-cliente"} · {CLOSURE_REASON_LABELS[closure.reason]} em {formatDate(closure.closedAt)}
        <Badge variant="outline">
          <StatusDot tone={PROSPECT_POTENTIAL_TONE[closure.potential]} />
          Potencial de voltar: {PROSPECT_POTENTIAL_LABELS[closure.potential]}
        </Badge>
      </p>
      <p className={compact ? "line-clamp-2 text-muted-foreground" : "whitespace-pre-wrap text-muted-foreground"}>{closure.description}</p>
      {!compact && (closure.closedByName || closure.reopenedAt) ? (
        <p className="text-[12px] text-subtle">
          {closure.closedByName ? `Encerrado por ${closure.closedByName}` : ""}
          {closure.reopenedAt ? `${closure.closedByName ? " · " : ""}reativado em ${formatDate(closure.reopenedAt)}` : ""}
        </p>
      ) : null}
    </div>
  );
}
