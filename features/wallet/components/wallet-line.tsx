import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/format";
import { WALLET_KIND_LABELS, type WalletLine } from "@/lib/wallet/wallet";

/** Uma linha da Carteira: descrição, de onde vem (cliente/projeto/meta), vencimento e valor. */
export function WalletLineItem({ line }: { line: WalletLine }) {
  const origin = [line.companyName, line.projectName, line.goalTitle ? `Meta: ${line.goalTitle}` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">{line.description}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <Badge variant="muted">{WALLET_KIND_LABELS[line.kind]}</Badge>
          {origin ? <span>{origin}</span> : null}
          <span>{line.virtual ? "Automático (fixo do mês)" : line.paidAt ? `Pago em ${formatDate(line.paidAt)}` : `Vencimento ${formatDate(line.dueDate)}`}</span>
        </p>
      </div>
      <Money cents={line.amountCents} className="shrink-0 text-sm font-bold tabular-nums" />
    </li>
  );
}
