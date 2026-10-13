"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { toneColor, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { TimelineState, WalletDetail, WalletDetailStatus } from "@/lib/wallet/detail";
import { WALLET_KIND_LABELS } from "@/lib/wallet/wallet";

const STATUS: Record<WalletDetailStatus, { label: string; tone: StatusTone }> = {
  a_receber: { label: "A receber", tone: "warning" },
  automatico: { label: "Previsto (fixo do mês)", tone: "warning" },
  pago: { label: "Pago", tone: "success" },
  estornado: { label: "Estornado", tone: "warning" },
};

const DOT: Record<TimelineState, StatusTone> = { done: "success", upcoming: "neutral", reversed: "warning" };

/** Detalhe de um item da Carteira: painel lateral no computador, painel de baixo (bottom sheet) no celular. */
export function WalletDetailSheet({ detail, onClose }: { detail: WalletDetail | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "wallet-scope fixed z-50 flex flex-col overflow-y-auto border-border-strong bg-surface shadow-2xl duration-200 focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            // Celular: painel que sobe de baixo.
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full",
            // Computador: gaveta à direita.
            "sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-[100dvh] sm:max-h-none sm:w-[440px] sm:rounded-none sm:border-l sm:border-t-0 sm:data-[state=closed]:slide-out-to-right-full sm:data-[state=open]:slide-in-from-right-full",
          )}
        >
          {detail ? <DetailBody detail={detail} /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DetailBody({ detail }: { detail: WalletDetail }) {
  const status = STATUS[detail.status];
  const origin: [string, string | null][] = [
    ["Cliente", detail.companyName],
    ["Projeto", detail.projectName],
    ["Meta", detail.goalTitle],
  ];
  return (
    <>
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
        <div className="min-w-0 space-y-2">
          <p className="eyebrow">{detail.reversal ? "Estorno" : "Detalhe do pagamento"}</p>
          <DialogPrimitive.Title className="font-display text-xl font-black tracking-tight break-words">{detail.description}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Dados do lançamento e linha do tempo do pagamento.</DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close className="-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-5" aria-hidden />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </div>

      <div className="space-y-6 px-5 sm:px-6">
        <div className="space-y-2">
          <Money
            cents={detail.amountCents}
            className={cn("block font-display text-3xl font-black tabular-nums", detail.reversal && "line-through decoration-2")}
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{WALLET_KIND_LABELS[detail.kind]}</Badge>
            <Badge variant="outline" style={{ color: toneColor(status.tone), borderColor: `color-mix(in srgb, ${toneColor(status.tone)} 40%, var(--border))` }}>
              {status.label}
            </Badge>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {origin
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="col-span-2 space-y-0.5">
                <dt className="text-xs font-semibold text-subtle">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          <div className="space-y-0.5">
            <dt className="text-xs font-semibold text-subtle">Categoria</dt>
            <dd className="font-semibold">{WALLET_KIND_LABELS[detail.kind]}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs font-semibold text-subtle">Vencimento</dt>
            <dd className="font-semibold">{detail.dueDate ? formatDate(detail.dueDate) : "—"}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs font-semibold text-subtle">Data de pagamento</dt>
            <dd className="font-semibold">{detail.payoutDate ? formatDate(detail.payoutDate) : "—"}</dd>
          </div>
        </dl>

        <section aria-labelledby="linha-do-tempo" className="space-y-3 pb-2">
          <h3 id="linha-do-tempo" className="section-title">
            Linha do tempo
          </h3>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {detail.timeline.map((step) => {
              const color = toneColor(DOT[step.state]);
              return (
                <li key={step.key} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[26px] top-1 size-2.5 rounded-full border-2"
                    style={{ borderColor: color ?? "var(--border-strong)", background: step.state === "upcoming" ? "var(--surface)" : color }}
                  />
                  <p className={cn("text-sm font-bold", step.state === "upcoming" && "text-muted-foreground")}>{step.label}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {step.at ? (step.withTime ? formatDateTime(step.at) : formatDate(step.at)) : null}
                    {step.at && step.note ? " · " : null}
                    {step.note}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}
