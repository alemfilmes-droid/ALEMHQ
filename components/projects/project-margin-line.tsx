import { AlertTriangle } from "lucide-react";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, toneColor } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { formatPercent } from "@/lib/margin";
import type { MarginStatus } from "@/types";

interface ProjectMarginLineProps {
  marginPct: number | null;
  marginStatus: MarginStatus | null;
  /** Meta de margem saudável (Configurações → Empresa). */
  target: number;
  /** Abaixo do crítico: quando a diretoria foi avisada (projects.margin_alert_at). */
  alertAt?: string | null;
}

/** Linha compacta no cabeçalho do projeto. Cor só no percentual. */
export function ProjectMarginLine({ marginPct, marginStatus, target, alertAt }: ProjectMarginLineProps) {
  if (marginPct == null || marginStatus == null) return null;

  return (
    <p className="text-sm text-muted-foreground">
      Margem prevista:{" "}
      <span className="font-bold" data-sensitive="percent" style={{ color: toneColor(MARGIN_STATUS_TONE[marginStatus]) }}>
        {String(marginPct).replace(".", ",")}%
      </span>{" "}
      — {MARGIN_STATUS_LABELS[marginStatus]} (meta: {formatPercent(target)})
      {marginStatus === "atencao" ? <span> · entra no relatório mensal de margem</span> : null}
      {alertAt ? (
        <span className="ml-2 inline-flex items-center gap-1 font-semibold" style={{ color: toneColor("danger") }}>
          <AlertTriangle className="size-3.5" aria-hidden />
          Margem crítica · diretoria avisada em {formatDate(alertAt)}
        </span>
      ) : null}
    </p>
  );
}
