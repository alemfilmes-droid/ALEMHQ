"use client";

import { useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronRight, FileText, Handshake, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CARD_LINK_CLASS, CardContent, CardHeading } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import { Money } from "@/components/ui/money";
import { BudgetStatusPill } from "@/features/budgets/components/budget-status-pill";
import type { BudgetStatus } from "@/features/budgets/types";
import { PROPOSAL_STATUS_LABELS } from "@/features/crm/labels";
import { formatCents } from "@/features/finance/money";
import type { NegotiationEntry, NegotiationOrigin, NegotiationSummary } from "@/lib/finance/negotiation";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { ProposalStatus } from "@/types";

const ORIGIN: Record<NegotiationOrigin, { label: string; icon: typeof Handshake }> = {
  crm: { label: "CRM", icon: Handshake },
  orcamento: { label: "Orçamento", icon: FileText },
};

export function OriginBadge({ origin }: { origin: NegotiationOrigin }) {
  const { label, icon: Icon } = ORIGIN[origin];
  return (
    <Badge variant="outline">
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

function EntryStatus({ entry }: { entry: NegotiationEntry }) {
  if (entry.origin === "orcamento") return <BudgetStatusPill status={entry.status as BudgetStatus} />;
  return <Badge variant="muted">Proposta {PROPOSAL_STATUS_LABELS[entry.status as ProposalStatus]?.toLowerCase() ?? entry.status}</Badge>;
}

/** Lista do "Em negociação": um cartão por item (bom no celular), com origem, cliente, valor, status e link. */
export function NegotiationList({ entries }: { entries: NegotiationEntry[] }) {
  if (entries.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nada em negociação agora.</p>;
  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.key}>
          <Link href={entry.href} className="flex items-start gap-3 py-3 outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring sm:px-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <OriginBadge origin={entry.origin} />
                <EntryStatus entry={entry} />
              </div>
              <p className="truncate font-semibold">{entry.clientName}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {entry.label} · {entry.description}
              </p>
              <p className="text-[12px] text-subtle">Atualizado {formatRelativeTime(entry.updatedAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              <Money cents={entry.amountCents} className="block font-bold tabular-nums" />
              {entry.weightedCents !== null ? (
                <span className="block text-[12px] text-muted-foreground" data-sensitive>
                  pond. {formatCents(entry.weightedCents)}
                </span>
              ) : null}
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-subtle" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Subtotal por origem + previsão ponderada (orçamentos fora do CRM não têm probabilidade). */
export function NegotiationTotals({ summary }: { summary: NegotiationSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      {(["orcamento", "crm"] as const).map((origin) => (
        <div key={origin} className="rounded-lg border border-border p-3">
          <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <OriginBadge origin={origin} />
            <span>
              {summary.byOrigin[origin].count} {summary.byOrigin[origin].count === 1 ? "item" : "itens"}
            </span>
          </dt>
          <dd className="mt-1">
            <Money cents={summary.byOrigin[origin].totalCents} className="font-bold tabular-nums" />
          </dd>
        </div>
      ))}
      <div className="col-span-2 rounded-lg border border-border p-3">
        <dt className="text-[13px] text-muted-foreground">Previsão ponderada (valor × probabilidade da etapa no CRM)</dt>
        <dd className="mt-1">
          <Money cents={summary.weightedCents} className="font-bold tabular-nums" />
        </dd>
      </div>
    </dl>
  );
}

/**
 * Card "Em negociação" do Dashboard: clicar abre o detalhe — gaveta à direita no computador, painel de baixo no
 * celular (mesmo padrão da Carteira).
 */
export function NegotiationCard({ summary }: { summary: NegotiationSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className={cn(CARD_LINK_CLASS, "relative")}>
        <DialogPrimitive.Trigger className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Em negociação: ${summary.count} itens. Abrir detalhe`} />
        <CardHeading icon={Handshake} tone="success" title="Em negociação" className="pointer-events-none relative pb-2 [&_button]:pointer-events-auto" sensitive />
        <CardContent className="pointer-events-none">
          <MetricValue value={summary.totalCents} format="cents" sensitive />
          <p className="mt-1 text-xs text-subtle" data-sensitive>
            {summary.count} {summary.count === 1 ? "item" : "itens"} · previsão ponderada {formatCents(summary.weightedCents)}
          </p>
        </CardContent>
      </div>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-y-auto border-border-strong bg-surface shadow-2xl duration-200 focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full",
            "sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-[100dvh] sm:max-h-none sm:w-[480px] sm:rounded-none sm:border-l sm:border-t-0 sm:data-[state=closed]:slide-out-to-right-full sm:data-[state=open]:slide-in-from-right-full",
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
            <div className="min-w-0 space-y-1">
              <p className="eyebrow">Financeiro · projeção comercial</p>
              <DialogPrimitive.Title className="font-display text-xl font-black tracking-tight">Em negociação</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[13px] text-muted-foreground">
                Orçamentos enviados, em análise ou em ajuste e negócios do CRM com proposta. Negócio com orçamento ligado conta uma vez só. Não é recebimento.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>
          </div>
          <div className="space-y-5 px-5 sm:px-6">
            <Money cents={summary.totalCents} className="block font-display text-3xl font-black tabular-nums" />
            <NegotiationTotals summary={summary} />
            <NegotiationList entries={summary.entries} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
