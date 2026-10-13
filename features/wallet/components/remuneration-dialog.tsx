"use client";

import { useEffect, useState } from "react";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLifecycleSubmit } from "@/features/clients/components/close-flow/use-lifecycle-submit";
import { centsToInput } from "@/features/finance/money";
import { getRemunerationAction, saveRemunerationAction } from "@/features/wallet/remuneration-actions";
import { todayInAppZone } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { MAX_PAYDAY, payoutDateFor } from "@/lib/wallet/payout-date";
import { REMUNERATION_TYPE_LABELS, REMUNERATION_TYPES, type RemunerationType } from "@/lib/wallet/wallet";

interface Props {
  profileId: string;
  name: string;
  onClose: () => void;
}

/** "Remuneração" da pessoa (só o master): tipo, fixo, dia de pagamento e % padrão de comissão. */
export function RemunerationDialog({ profileId, name, onClose }: Props) {
  const { pending, failure, submit } = useLifecycleSubmit(onClose);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<RemunerationType>("so_comissao");
  const [fixedAmount, setFixedAmount] = useState("");
  const [payday, setPayday] = useState(10);
  const [commissionPercent, setCommissionPercent] = useState("");

  useEffect(() => {
    let active = true;
    void getRemunerationAction(profileId).then((current) => {
      if (!active) return;
      if (current) {
        setType(current.type);
        setFixedAmount(current.fixedAmountCents ? centsToInput(current.fixedAmountCents) : "");
        setPayday(current.payday);
        setCommissionPercent(current.defaultCommissionPercent === null ? "" : String(current.defaultCommissionPercent).replace(".", ","));
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [profileId]);

  const hasFixed = type === "fixo" || type === "fixo_mais_variavel";
  const today = todayInAppZone();

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Remuneração.</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        {!loaded ? (
          <div className="space-y-2" aria-label="Carregando a remuneração">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : (
          <div className="space-y-4">
            <FormField id="rem-type" label="Tipo">
              <NativeSelect id="rem-type" value={type} onChange={(event) => setType(event.target.value as RemunerationType)}>
                {REMUNERATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {REMUNERATION_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {hasFixed ? (
              <FormField id="rem-fixed" label="Fixo mensal (R$)" hint="Aparece sozinho na Carteira no dia de pagamento, até o financeiro lançar.">
                <Input id="rem-fixed" inputMode="decimal" placeholder="0,00" value={fixedAmount} onChange={(event) => setFixedAmount(event.target.value)} />
              </FormField>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="rem-payday" label="Dia de pagamento" hint={`Ex.: vencimento hoje cai em ${formatDate(payoutDateFor(today, payday))}.`}>
                <NativeSelect id="rem-payday" value={String(payday)} onChange={(event) => setPayday(Number(event.target.value))}>
                  {Array.from({ length: MAX_PAYDAY }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      Dia {day}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="rem-commission" label="Comissão padrão (%)" hint="Opcional.">
                <Input id="rem-commission" inputMode="decimal" placeholder="Ex.: 5" value={commissionPercent} onChange={(event) => setCommissionPercent(event.target.value)} />
              </FormField>
            </div>
          </div>
        )}
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="lg"
            loading={pending}
            disabled={!loaded}
            onClick={() => submit(() => saveRemunerationAction({ profileId, type, fixedAmount, payday, commissionPercent }))}
          >
            Salvar remuneração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
