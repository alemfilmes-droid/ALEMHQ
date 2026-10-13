import Link from "next/link";
import { CalendarClock, Handshake, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PersonPicker } from "@/features/wallet/components/person-picker";
import { WalletLineItem } from "@/features/wallet/components/wallet-line";
import type { WalletPage as WalletData } from "@/features/wallet/queries";
import { monthYearLabel, weekdayLong } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { paidInMonth, REMUNERATION_TYPE_LABELS } from "@/lib/wallet/wallet";

const MONTH = /^\d{4}-\d{2}$/;

/** Tela da Carteira (só leitura): próximo pagamento, a receber por data, pagos por mês e "Em negociação". */
export function WalletScreen({ data, viewerId, mes }: { data: WalletData; viewerId: string; mes: string | undefined }) {
  const { view, remuneration, today, person, people } = data;
  const own = person.id === viewerId;
  const months = [...new Set(view.paid.map((line) => (line.paidAt ?? "").slice(0, 7)))].filter(Boolean).sort().reverse();
  const month = mes && MONTH.test(mes) ? mes : (months[0] ?? today.slice(0, 7));
  const paid = paidInMonth(view.paid, month);
  const paidTotal = paid.reduce((sum, line) => sum + line.amountCents, 0);
  const monthHref = (value: string) => `/carteira?${new URLSearchParams({ ...(own ? {} : { pessoa: person.id }), mes: value }).toString()}`;

  return (
    <>
      <PageHeader
        panel="/carteira"
        eyebrow="Principal"
        title="Carteira."
        description={
          own
            ? "O que você tem a receber, quando e de onde. Os valores vêm do Financeiro; dúvidas, fale com o financeiro."
            : `Carteira de ${person.name}. Só leitura: os valores vêm do Financeiro.`
        }
      />

      <div className="space-y-8">
        {people.length > 0 ? <PersonPicker people={people} current={person.id} /> : null}

        <Card className="space-y-2 p-5">
          <p className="eyebrow flex items-center gap-2">
            <Wallet className="size-4" aria-hidden />
            Próximo pagamento
          </p>
          {view.next ? (
            <>
              <Money cents={view.next.totalCents} className="block font-display text-3xl font-black tabular-nums" />
              <p className="text-sm text-muted-foreground">
                {weekdayLong(view.next.date)}, {formatDate(view.next.date)}
                {view.next.date < today ? " · em atraso" : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nada a receber por enquanto.</p>
          )}
          <p className="text-[12px] text-subtle">
            {remuneration
              ? `${REMUNERATION_TYPE_LABELS[remuneration.type]} · pagamento todo dia ${remuneration.payday}`
              : "Dia de pagamento ainda não definido: os valores aparecem na data do vencimento."}
          </p>
        </Card>

        <section aria-labelledby="a-receber" className="space-y-3">
          <h2 id="a-receber" className="section-title">
            A receber
          </h2>
          {view.toReceive.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">Nenhum valor a receber.</p>
          ) : (
            view.toReceive.map((group) => (
              <Card key={group.date} className="p-4">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    {formatDate(group.date)}
                    {group.date < today ? <span className="text-[12px] font-semibold text-[var(--status-alert)]">em atraso</span> : null}
                  </p>
                  <Money cents={group.totalCents} className="text-sm font-bold tabular-nums" />
                </div>
                <ul className="divide-y divide-border">
                  {group.lines.map((line) => (
                    <WalletLineItem key={line.id} line={line} />
                  ))}
                </ul>
              </Card>
            ))
          )}
        </section>

        <section aria-labelledby="pago" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="pago" className="section-title">
              Pago
            </h2>
            {months.length > 0 ? (
              <nav aria-label="Mês" className="flex max-w-full gap-2 overflow-x-auto">
                {months.map((value) => (
                  <Link
                    key={value}
                    href={monthHref(value)}
                    aria-current={value === month ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold",
                      value === month ? "border-foreground bg-surface-hover text-foreground" : "border-border-strong text-muted-foreground",
                    )}
                  >
                    {monthYearLabel(`${value}-01`)}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
          {paid.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">Nenhum pagamento neste mês.</p>
          ) : (
            <Card className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 text-sm font-bold">
                <span>{monthYearLabel(`${month}-01`)}</span>
                <Money cents={paidTotal} className="tabular-nums" />
              </div>
              <ul className="divide-y divide-border">
                {paid.map((line) => (
                  <WalletLineItem key={line.id} line={line} />
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section aria-labelledby="negociacao" className="space-y-3">
          <h2 id="negociacao" className="section-title">
            Em negociação
          </h2>
          <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
            <Handshake className="mb-2 size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Em breve: previsões do CRM</p>
          </div>
        </section>
      </div>
    </>
  );
}
