import { Money } from "@/components/ui/money";
import { parseMoneyToCents, sumCents } from "@/features/finance/money";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, toneColor } from "@/lib/status";
import { DEFAULT_MARGIN_THRESHOLDS, marginStatusFor, type MarginThresholds } from "@/lib/margin";

interface MarginPreviewProps {
  contractValue: string;
  costAmounts: string[];
  /** Limiares de company_settings (Configurações → Empresa). */
  thresholds?: MarginThresholds;
}

/** Prévia ao vivo enquanto o valor do contrato e os custos são digitados. Cor só no percentual. */
export function MarginPreview({ contractValue, costAmounts, thresholds = DEFAULT_MARGIN_THRESHOLDS }: MarginPreviewProps) {
  const contractCents = parseMoneyToCents(contractValue);
  if (!contractCents || contractCents <= 0) return null;

  const costsCents = sumCents(costAmounts.map((amount) => parseMoneyToCents(amount) ?? 0));
  const marginCents = contractCents - costsCents;
  const percent = Math.round((marginCents / contractCents) * 1000) / 10;
  const status = marginStatusFor(percent, thresholds);

  return (
    <p className="rounded-md border border-border bg-surface-raised p-3 text-[13px] text-muted-foreground">
      Margem prevista: <Money cents={marginCents} /> —{" "}
      <span className="font-bold" style={{ color: toneColor(MARGIN_STATUS_TONE[status]) }}>
        {String(percent).replace(".", ",")}%
      </span>{" "}
      ({MARGIN_STATUS_LABELS[status]})
    </p>
  );
}
