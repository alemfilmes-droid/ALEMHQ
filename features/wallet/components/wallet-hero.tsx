import { CalendarClock, Wallet } from "lucide-react";
import { MetricValue } from "@/components/ui/metric-value";
import { weekdayLong } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { toneColor } from "@/lib/status";
import { REMUNERATION_TYPE_LABELS, type Remuneration, type WalletView } from "@/lib/wallet/wallet";

interface Props {
  next: WalletView["next"];
  /** Itens que caem na data do próximo pagamento. */
  count: number;
  today: string;
  remuneration: Remuneration | null;
}

/** "Próximo pagamento": cartão escuro com a luz que percorre a borda (estilos .wallet-hero em app/globals.css). */
export function WalletHero({ next, count, today, remuneration }: Props) {
  const late = next !== null && next.date < today;
  return (
    <section aria-labelledby="proximo-pagamento" className="wallet-hero">
      <div className="wallet-hero-inner flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div className="min-w-0 flex-1 space-y-3">
          <p id="proximo-pagamento" className="eyebrow flex items-center gap-2 text-muted-foreground">
            <Wallet className="size-4" aria-hidden />
            Próximo pagamento
          </p>
          {next ? (
            <>
              <MetricValue value={next.totalCents} format="cents" size="display" className="text-foreground" />
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden />
                <span className="font-semibold text-foreground">
                  {weekdayLong(next.date)}, {formatDate(next.date)}
                </span>
                {late ? (
                  <span className="text-[12px] font-bold" style={{ color: toneColor("warning") }}>
                    em atraso
                  </span>
                ) : null}
                <span>· {count === 1 ? "1 item" : `${count} itens`}</span>
              </p>
            </>
          ) : (
            <div className="space-y-1">
              <p className="font-display text-3xl font-black tracking-tight text-foreground">Nada a receber</p>
              <p className="text-sm text-muted-foreground">Quando o Financeiro lançar um pagamento para você, ele aparece aqui.</p>
            </div>
          )}
        </div>
        <p className="max-w-xs text-[12px] text-subtle sm:text-right">
          {remuneration
            ? `${REMUNERATION_TYPE_LABELS[remuneration.type]} · pagamento todo dia ${remuneration.payday}`
            : "Dia de pagamento ainda não definido: os valores caem na data do vencimento."}
        </p>
      </div>
    </section>
  );
}
