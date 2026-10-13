"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, ChevronRight, History, Inbox, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import { Money } from "@/components/ui/money";
import { WalletDetailSheet } from "@/features/wallet/components/wallet-detail-sheet";
import { formatDate, formatDateTime } from "@/lib/format";
import { toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";
import { detailFromEvent, detailFromLine, eventKind, type WalletDetail } from "@/lib/wallet/detail";
import type { LedgerEvent, MonthStatement } from "@/lib/wallet/ledger";
import { WALLET_KIND_LABELS, type WalletGroup, type WalletKind } from "@/lib/wallet/wallet";

interface Props {
  tab: "a-receber" | "historico";
  groups: WalletGroup[];
  statement: MonthStatement;
  monthLabel: string;
  /** Seletor de mês (MonthSelector do Financeiro/Banco de horas), montado no servidor. */
  monthSelector: ReactNode;
  ledger: LedgerEvent[];
  today: string;
}

const SUCCESS = toneColor("success");
const WARNING = toneColor("warning");

/** Abas "A receber" e "Histórico" (extrato do mês); clicar num item abre o detalhe. */
export function WalletPanel({ tab, groups, statement, monthLabel, monthSelector, ledger, today }: Props) {
  const [detail, setDetail] = useState<WalletDetail | null>(null);
  const reversed = new Set(ledger.flatMap((event) => (event.reversesEventId ? [event.reversesEventId] : [])));

  return (
    <>
      {tab === "a-receber" ? (
        groups.length === 0 ? (
          <EmptyState icon={Inbox} title="Nada a receber agora.">
            Quando o Financeiro lançar um pagamento para você, ele aparece aqui, na data em que cai na Carteira.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.date} variant="static" className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    {formatDate(group.date)}
                    {group.date < today ? (
                      <span className="text-[12px] font-semibold" style={{ color: WARNING }}>
                        em atraso
                      </span>
                    ) : null}
                  </p>
                  <Money cents={group.totalCents} className="text-sm font-bold tabular-nums" />
                </div>
                <ul className="divide-y divide-border">
                  {group.lines.map((line) => (
                    <li key={line.id}>
                      <Row
                        onOpen={() => setDetail(detailFromLine(line, ledger, today))}
                        title={line.description}
                        kind={line.kind}
                        origin={origin(line)}
                        meta={line.virtual ? "Automático (fixo do mês)" : `Vencimento ${formatDate(line.dueDate)}`}
                        amount={<Money cents={line.amountCents} className="text-sm font-bold tabular-nums" />}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {monthSelector}
          </div>
          <Card variant="static" className="flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Total recebido em {monthLabel}</p>
              <MetricValue value={statement.totalCents} format="cents" size="lg" tone={statement.totalCents > 0 ? "success" : undefined} />
            </div>
            <p className="text-xs text-subtle">
              {countLabel(statement.events.filter((event) => event.kind === "payout").length, "pagamento", "pagamentos")}
              {statement.reversalsCents > 0 ? (
                <>
                  {" · "}
                  {countLabel(statement.events.filter((event) => event.kind === "reversal").length, "estorno", "estornos")}
                </>
              ) : null}
            </p>
          </Card>

          {statement.events.length === 0 ? (
            <EmptyState icon={History} title={`Nenhum pagamento em ${monthLabel}.`}>
              Use as setas para ver outros meses. Cada pagamento confirmado pelo Financeiro aparece aqui com data e hora.
            </EmptyState>
          ) : (
            <Card variant="static" className="p-4 sm:p-5">
              <ul className="divide-y divide-border">
                {statement.events.map((event) => {
                  const isReversal = event.kind === "reversal";
                  return (
                    <li key={event.id} className={cn(isReversal && "-mx-2 rounded-md border-l-2 px-2")} style={isReversal ? { borderColor: WARNING } : undefined}>
                      <Row
                        onOpen={() => setDetail(detailFromEvent(event, ledger, today))}
                        title={event.description}
                        kind={eventKind(event)}
                        badge={
                          isReversal ? (
                            <Badge variant="outline" style={{ color: WARNING }}>
                              <Undo2 aria-hidden />
                              Estorno
                            </Badge>
                          ) : reversed.has(event.id) ? (
                            <Badge variant="outline">Estornado depois</Badge>
                          ) : null
                        }
                        origin={origin(event)}
                        meta={eventMeta(event)}
                        amount={
                          <span className="flex items-baseline gap-0.5 text-sm font-bold tabular-nums" style={{ color: isReversal ? WARNING : SUCCESS }}>
                            <span aria-hidden>{isReversal ? "−" : "+"}</span>
                            <span className="sr-only">{isReversal ? "menos" : "mais"}</span>
                            <Money cents={event.amountCents} />
                          </span>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      <WalletDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function origin(item: { companyName: string | null; projectName: string | null; goalTitle: string | null }): string {
  return [item.companyName, item.projectName, item.goalTitle ? `Meta: ${item.goalTitle}` : null].filter(Boolean).join(" · ");
}

function eventMeta(event: LedgerEvent): string {
  const when = event.timeRecorded ? formatDateTime(event.occurredAt) : `${formatDate(event.paidOn)} · horário não registrado`;
  const who = event.kind === "reversal" ? (event.actorName ? `Estornado por ${event.actorName}` : "Estorno") : event.actorName ? `Confirmado por ${event.actorName}` : null;
  return [when, who].filter(Boolean).join(" · ");
}

function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

interface RowProps {
  onOpen: () => void;
  title: string;
  kind: WalletKind;
  badge?: ReactNode;
  origin: string;
  meta: string;
  amount: ReactNode;
}

function Row({ onOpen, title, kind, badge, origin, meta, amount }: RowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-11 w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-surface-hover/40"
    >
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <Badge variant="muted">{WALLET_KIND_LABELS[kind]}</Badge>
          {badge}
          {origin ? <span>{origin}</span> : null}
        </span>
        <span className="block text-[12px] text-subtle">{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {amount}
        <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </button>
  );
}

function EmptyState({ icon: Icon, title, children }: { icon: typeof Inbox; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <Icon className="mb-2 size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}
