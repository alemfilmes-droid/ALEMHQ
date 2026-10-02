"use client";

import { useEffect, useState } from "react";
import { Copy, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_METHOD_LABELS } from "@/features/finance/labels";
import { getPayeePaymentDetailsAction } from "@/features/goals/actions";
import { BANK_ACCOUNT_TYPE_LABELS, PIX_KEY_TYPE_LABELS, type PaymentDetailsItem } from "@/features/goals/types";
import { cn } from "@/lib/utils";

function CopyValue({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-[12px] font-semibold text-muted-foreground">{label}</dt>
        <dd className="break-all font-semibold">{value}</dd>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={`Copiar ${label.toLowerCase()}`}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado.`));
        }}
      >
        <Copy aria-hidden />
      </Button>
    </div>
  );
}

/**
 * Dados de pagamento cadastrados pela pessoa (Perfil → Dados para pagamento), para o financeiro
 * pagar salário, comissão ou pró-labore. Carrega sob demanda; a RLS só entrega a quem tem acesso.
 */
export function PayeePaymentDetails({ profileId, className }: { profileId: string; className?: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; details: PaymentDetailsItem | null } | { status: "error"; error: string }>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    void getPayeePaymentDetailsAction(profileId).then((result) => {
      if (!active) return;
      setState(result.ok ? { status: "ready", details: result.details } : { status: "error", error: result.error });
    });
    return () => {
      active = false;
    };
  }, [profileId]);

  if (state.status === "loading") return <Skeleton className={cn("h-24 w-full", className)} />;
  if (state.status === "error") return <p className={cn("text-sm text-muted-foreground", className)}>{state.error}</p>;

  const details = state.details;
  if (!details) {
    return (
      <p className={cn("rounded-md border border-dashed border-border-strong p-3 text-sm text-muted-foreground", className)}>
        A pessoa ainda não cadastrou os dados de pagamento (Perfil → Dados para pagamento).
      </p>
    );
  }

  const bank = [details.bankCode, details.bankName].filter(Boolean).join(" · ");
  const account = [details.agency ? `Ag. ${details.agency}` : null, details.accountNumber ? `Conta ${details.accountNumber}` : null, details.accountType ? BANK_ACCOUNT_TYPE_LABELS[details.accountType] : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("space-y-3 rounded-md border border-border bg-surface-raised p-3 text-sm", className)}>
      <p className="flex items-center gap-2 text-[12px] font-bold text-muted-foreground">
        <Landmark className="size-3.5" aria-hidden />
        Prefere receber por {PAYMENT_METHOD_LABELS[details.preferredMethod]}
      </p>
      <dl className="space-y-2">
        <CopyValue label={details.pixKeyType ? `Pix (${PIX_KEY_TYPE_LABELS[details.pixKeyType]})` : "Pix"} value={details.pixKey} />
        <CopyValue label="Titular" value={[details.holderName, details.holderDocument].filter(Boolean).join(" · ") || null} />
        {bank ? <CopyValue label="Banco" value={bank} /> : null}
        {account ? <CopyValue label="Conta" value={account} /> : null}
      </dl>
      {details.notes ? <p className="text-[13px] text-muted-foreground">{details.notes}</p> : null}
    </div>
  );
}

export function PayeePaymentDetailsDialog({ profileId, name, onOpenChange }: { profileId: string; name: string; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dados para pagamento.</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <PayeePaymentDetails profileId={profileId} />
      </DialogContent>
    </Dialog>
  );
}
