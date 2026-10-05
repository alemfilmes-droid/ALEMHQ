import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { CardContent, CardHeading } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { getScheduledPaymentsDue } from "@/features/finance/queries";
import { todayInAppZone } from "@/lib/calendar";
import { formatDate } from "@/lib/format";

/** /inicio do financeiro: pagamentos agendados para hoje (ou antes) ainda sem baixa. Some quando não há. */
export async function ScheduledPaymentsCard() {
  const today = todayInAppZone();
  const items = await getScheduledPaymentsDue(today);
  if (items.length === 0) return null;
  return (
    <div className="card-surface flex h-full flex-col rounded-lg">
      <CardHeading icon={CalendarClock} tone="warning" title="Pagamentos agendados — dar baixa" sensitive />
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/financeiro?aba=pagamentos&pagamento=${item.id}`}
                className="block rounded-md border border-border px-3 py-2 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{item.payee}</span>
                  <Money cents={item.amount} className="font-bold" />
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  {item.description} · {item.scheduledFor === today ? "agendado para hoje" : `agendado em ${formatDate(item.scheduledFor)} — sem baixa`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </div>
  );
}
