import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, toneColor } from "@/lib/status";
import type { MarginStatus } from "@/types";

interface ProjectMarginLineProps {
  marginPct: number | null;
  marginStatus: MarginStatus | null;
}

/** Linha compacta no cabeçalho do projeto. Cor só no percentual. */
export function ProjectMarginLine({ marginPct, marginStatus }: ProjectMarginLineProps) {
  if (marginPct == null || marginStatus == null) return null;

  return (
    <p className="text-sm text-muted-foreground">
      Margem prevista:{" "}
      <span className="font-bold" style={{ color: toneColor(MARGIN_STATUS_TONE[marginStatus]) }}>
        {String(marginPct).replace(".", ",")}%
      </span>{" "}
      — {MARGIN_STATUS_LABELS[marginStatus]} (meta: 50%)
    </p>
  );
}
