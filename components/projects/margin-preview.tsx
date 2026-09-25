import { formatCents, parseMoneyToCents, sumCents } from "@/features/finance/money";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, toneColor } from "@/lib/status";
import type { MarginStatus } from "@/types";

interface MarginPreviewProps {
  contractValue: string;
  costAmounts: string[];
}

function computeStatus(percent: number): MarginStatus {
  if (percent >= 50) return "saudavel";
  if (percent >= 47) return "atencao";
  return "critico";
}

/** Prévia ao vivo enquanto o valor do contrato e os custos são digitados. Cor só no percentual. */
export function MarginPreview({ contractValue, costAmounts }: MarginPreviewProps) {
  const contractCents = parseMoneyToCents(contractValue);
  if (!contractCents || contractCents <= 0) return null;

  const costsCents = sumCents(costAmounts.map((amount) => parseMoneyToCents(amount) ?? 0));
  const marginCents = contractCents - costsCents;
  const percent = Math.round((marginCents / contractCents) * 1000) / 10;
  const status = computeStatus(percent);

  return (
    <p className="rounded-md border border-border bg-surface-raised p-3 text-[13px] text-muted-foreground">
      Margem prevista: {formatCents(marginCents)} —{" "}
      <span className="font-bold" style={{ color: toneColor(MARGIN_STATUS_TONE[status]) }}>
        {String(percent).replace(".", ",")}%
      </span>{" "}
      ({MARGIN_STATUS_LABELS[status]})
    </p>
  );
}
