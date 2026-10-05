"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ExternalLink, Landmark, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { MetricValue } from "@/components/ui/metric-value";
import { RichText } from "@/components/ui/rich-text";
import { schedulePayableAction } from "@/features/finance/actions";
import { PayableDialog } from "@/features/finance/components/payable-dialog";
import { SettlePayableDialog } from "@/features/finance/components/settle-dialogs";
import { StatusBadge } from "@/features/finance/components/status-badge";
import { PAYABLE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/features/finance/labels";
import { formatCents } from "@/features/finance/money";
import type { FinanceOptions, PayableItem } from "@/features/finance/types";
import { CopyValue, PayeePaymentDetails } from "@/features/goals/components/payee-payment-details";
import { BANK_ACCOUNT_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from "@/features/goals/types";
import { formatDate } from "@/lib/format";

/** "Agendado para dd/mm" — e se a data passou sem baixa. */
export function ScheduledMarker({ item, today }: { item: PayableItem; today: string }) {
  if (!item.scheduledFor || item.paidAt || item.status === "cancelado") return null;
  const overdue = item.scheduledFor < today;
  return (
    <Badge variant="outline" className={overdue ? "font-bold" : undefined}>
      <CalendarClock aria-hidden />
      {overdue ? `Agendado ${formatDate(item.scheduledFor)} — sem baixa` : item.scheduledFor === today ? "Agendado para hoje" : `Agendado para ${formatDate(item.scheduledFor)}`}
    </Badge>
  );
}

function PayeeData({ item, onEdit }: { item: PayableItem; onEdit: () => void }) {
  if (item.payeeProfileId) {
    return (
      <div className="space-y-2">
        <PayeePaymentDetails profileId={item.payeeProfileId} />
        <p className="text-[12px] text-subtle">Dados do perfil da pessoa (Perfil → Dados para pagamento).</p>
      </div>
    );
  }
  const p = item.payee;
  const bank = [p.bankName, p.agency ? `Ag. ${p.agency}` : null, p.account ? `Conta ${p.account}` : null, p.accountType ? BANK_ACCOUNT_TYPE_LABELS[p.accountType] : null]
    .filter(Boolean)
    .join(" · ");
  if (!p.pixKey && !bank && !p.holderName) {
    return (
      <div className="rounded-md border border-dashed border-border-strong p-3 text-sm text-muted-foreground">
        Nenhum dado de pagamento neste custo.{" "}
        <button type="button" onClick={onEdit} className="font-semibold text-foreground underline underline-offset-2">
          Preencher no custo
        </button>
      </div>
    );
  }
  return (
    <dl className="space-y-2 rounded-md border border-border bg-surface-raised p-3 text-sm">
      <CopyValue label={p.pixKeyType ? `Pix (${PIX_KEY_TYPE_LABELS[p.pixKeyType]})` : "Pix"} value={p.pixKey} />
      <CopyValue label="Titular" value={p.holderName} />
      <CopyValue label="CPF/CNPJ" value={p.document} />
      {bank ? <CopyValue label="Banco" value={bank} /> : null}
    </dl>
  );
}

function ScheduleDialog({ item, today, onOpenChange }: { item: PayableItem; today: string; onOpenChange: (open: boolean) => void }) {
  const [date, setDate] = useState(item.scheduledFor ?? today);
  const [pending, startTransition] = useTransition();
  function save(value: string | null) {
    startTransition(async () => {
      const result = await schedulePayableAction(item.id, value);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else toast.error(result.error);
    });
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar pagamento.</DialogTitle>
          <DialogDescription>Agendar não é pagar: o pagamento continua em aberto em todos os totais até a baixa. No dia, o sistema lembra de dar baixa.</DialogDescription>
        </DialogHeader>
        <FormField id="schedule-date" label="Agendado para">
          <Input id="schedule-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <DialogFooter>
          {item.scheduledFor ? (
            <Button type="button" variant="ghost" onClick={() => save(null)} disabled={pending}>
              Remover agendamento
            </Button>
          ) : null}
          <Button type="button" onClick={() => save(date)} loading={pending} disabled={!date}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pagamento executável: favorecido, valor, vencimento, os dados para pagar (com copiar) e as ações
 * "Dar baixa" e "Agendar pagamento". Só quem tem financeiro chega aqui (rota + RLS).
 */
export function PaymentModal({ item, options, today, onOpenChange }: { item: PayableItem; options: FinanceOptions; today: string; onOpenChange: (open: boolean) => void }) {
  const [settling, setSettling] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(false);
  const open = item.status === "pendente" || item.status === "atrasado";

  return (
    <>
      <Dialog open={!settling && !scheduling && !editing} onOpenChange={(next) => !next && onOpenChange(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {item.payeeLabel}
              <StatusBadge status={item.status} />
            </DialogTitle>
            <DialogDescription>
              {item.projectId ? (
                <Link href={`/projetos/${item.projectId}?aba=financeiro`} className="underline underline-offset-2">
                  {item.projectName}
                </Link>
              ) : (
                "Custo da empresa"
              )}{" "}
              · {PAYABLE_CATEGORY_LABELS[item.category]}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] text-muted-foreground">Valor</p>
              <MetricValue value={item.amount} format="cents" size="xl" />
              {item.originalAmount != null && item.penaltyAmount != null ? (
                <p className="text-[12px] text-muted-foreground">
                  {formatCents(item.originalAmount)} + {formatCents(item.penaltyAmount)} de multa/juros
                </p>
              ) : null}
            </div>
            <div className="space-y-1 text-right text-sm">
              <p>
                <span className="text-muted-foreground">Vencimento </span>
                <strong>{formatDate(item.dueDate)}</strong>
              </p>
              <ScheduledMarker item={item} today={today} />
            </div>
          </div>

          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
              <Landmark className="size-3.5" aria-hidden />
              Dados para pagamento
            </p>
            <PayeeData item={item} onEdit={() => setEditing(true)} />
          </section>

          <section className="space-y-1 text-sm">
            <p className="font-semibold">{item.description}</p>
            {item.notes ? <RichText source={item.notes} className="text-[13px]" /> : null}
          </section>

          {item.paidAt ? (
            <div className="space-y-1 rounded-md border border-border p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="size-4" aria-hidden />
                Pago em {formatDate(item.paidAt)}
                {item.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[item.paymentMethod]}` : ""}
              </p>
              {item.paidLate ? (
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Pago com atraso: {item.lateReason}
                  {item.penaltyAmount != null ? ` · multa/juros ${formatCents(item.penaltyAmount)} (${item.penaltyReason})` : ""}
                </p>
              ) : null}
              {item.receiptUrl ? (
                <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                  Comprovante
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="flex-wrap gap-2">
            {open ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden />
                  Editar
                </Button>
                <Button type="button" variant="secondary" onClick={() => setScheduling(true)}>
                  <CalendarClock aria-hidden />
                  {item.scheduledFor ? "Reagendar" : "Agendar pagamento"}
                </Button>
                <Button type="button" onClick={() => setSettling(true)}>
                  <CheckCircle2 aria-hidden />
                  Dar baixa no pagamento
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {settling ? (
        <SettlePayableDialog
          payable={item}
          open
          today={today}
          onOpenChange={(next) => {
            setSettling(next);
            if (!next) onOpenChange(false);
          }}
        />
      ) : null}
      {scheduling ? <ScheduleDialog item={item} today={today} onOpenChange={(next) => (next ? null : setScheduling(false))} /> : null}
      {editing ? (
        <PayableDialog mode="edit" payable={item} options={options} today={today} lockedProjectId={item.projectId ?? undefined} open onOpenChange={setEditing} />
      ) : null}
    </>
  );
}
