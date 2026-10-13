import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { MonthSelector } from "@/features/time-tracking/components/month-selector";
import { PersonPicker } from "@/features/wallet/components/person-picker";
import { WalletHero } from "@/features/wallet/components/wallet-hero";
import { WalletKpis } from "@/features/wallet/components/wallet-kpis";
import { WalletPanel } from "@/features/wallet/components/wallet-panel";
import type { WalletPage as WalletData } from "@/features/wallet/queries";
import { monthYearLabel } from "@/lib/calendar";
import { receivedInYear, statementForMonth } from "@/lib/wallet/ledger";

const MONTH = /^\d{4}-\d{2}$/;
const TABS = [
  { key: "a-receber", label: "A receber" },
  { key: "historico", label: "Histórico" },
] as const;

/**
 * Tela da Carteira (só leitura): próximo pagamento, indicadores, "A receber" por data de pagamento e o
 * "Histórico" (extrato do mês). Tudo dentro de .wallet-scope: o vermelho da marca fica só no logo.
 */
export function WalletScreen({ data, viewerId, mes, aba }: { data: WalletData; viewerId: string; mes: string | undefined; aba: string | undefined }) {
  const { view, ledger, remuneration, today, person, people } = data;
  const own = person.id === viewerId;
  const currentMonth = today.slice(0, 7);
  const month = mes && MONTH.test(mes) ? mes : currentMonth;
  const tab = TABS.find((item) => item.key === aba)?.key ?? (mes ? "historico" : "a-receber");

  const statement = statementForMonth(ledger, month);
  const thisMonth = statementForMonth(ledger, currentMonth);
  const lines = view.toReceive.flatMap((group) => group.lines);
  const nextGroup = view.next ? view.toReceive.find((group) => group.date === view.next?.date) : undefined;

  const tabHref = (key: string) => {
    const query = new URLSearchParams({ ...(own ? {} : { pessoa: person.id }), aba: key, ...(mes ? { mes } : {}) });
    return `/carteira?${query.toString()}`;
  };

  return (
    <div className="wallet-scope">
      <PageHeader
        panel="/carteira"
        eyebrow="Principal"
        title="Carteira."
        description={
          own
            ? "O que você tem a receber, quando e de onde. Os valores vêm do Financeiro; dúvidas, fale com o financeiro."
            : `Carteira de ${person.name}. Só leitura: os valores vêm do Financeiro.`
        }
        actions={people.length > 0 ? <PersonPicker people={people} current={person.id} /> : undefined}
      />

      <div className="space-y-6 sm:space-y-8">
        <WalletHero next={view.next} count={nextGroup?.lines.length ?? 0} today={today} remuneration={remuneration} />

        <WalletKpis
          toReceiveCents={lines.reduce((sum, line) => sum + line.amountCents, 0)}
          toReceiveCount={lines.length}
          receivedMonthCents={thisMonth.totalCents}
          receivedYearCents={receivedInYear(ledger, today.slice(0, 4))}
          monthLabel={capitalize(monthYearLabel(`${currentMonth}-01`))}
          year={today.slice(0, 4)}
        />

        <section aria-label="Pagamentos" className="space-y-4">
          <LinkTabs label="Seções da Carteira" tone="neutral" tabs={TABS.map((item) => ({ href: tabHref(item.key), label: item.label, active: item.key === tab }))} />
          <WalletPanel
            tab={tab}
            groups={view.toReceive}
            statement={statement}
            monthLabel={monthYearLabel(`${month}-01`)}
            monthSelector={
              <Suspense>
                <MonthSelector yearMonth={month} />
              </Suspense>
            }
            ledger={ledger}
            today={today}
          />
        </section>
      </div>
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
