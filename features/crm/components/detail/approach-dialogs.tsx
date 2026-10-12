"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { editApproachAction, strikeApproachAction } from "@/features/crm/interaction-actions";
import { INTERACTION_CHANNEL_LABELS, INTERACTION_CHANNELS } from "@/features/crm/labels";
import type { DealInteractionDetail } from "@/features/crm/types";
import { needsReload, runAction } from "@/lib/actions/client-action";
import { dateInAppZone, todayInAppZone } from "@/lib/calendar";
import { formatDateTime } from "@/lib/format";
import type { DealInteractionChannel } from "@/types";

interface ApproachDialogProps {
  item: DealInteractionDetail;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

function useSubmit(onDone: () => void, onOpenChange: (open: boolean) => void) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<{ message: string; reload: boolean } | null>(null);
  function submit(call: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    setFailure(null);
    startTransition(async () => {
      const result = await runAction(call);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        onDone();
      } else setFailure({ message: result.error, reload: needsReload(result) });
    });
  }
  return { pending, failure, submit };
}

const timeInAppZone = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** Editar abordagem: canal, data/horário efetivo e observação. O histórico guarda o antes e depois. */
export function ApproachEditDialog({ item, onOpenChange, onDone }: ApproachDialogProps) {
  const { pending, failure, submit } = useSubmit(onDone, onOpenChange);
  const [channel, setChannel] = useState<DealInteractionChannel | "">(item.channel ?? "");
  const [date, setDate] = useState(dateInAppZone(item.occurred_at));
  const [time, setTime] = useState(timeInAppZone(item.occurred_at));
  const [summary, setSummary] = useState(item.summary ?? item.body);
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Editar abordagem.</DialogTitle>
          <DialogDescription>Registrada em {formatDateTime(item.created_at)}. A cadência passa a contar do horário corrigido.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(() => editApproachAction({ id: item.id, channel: channel as DealInteractionChannel, date, time, summary, reason }));
          }}
        >
          <ActionError message={failure?.message ?? null} reload={failure?.reload} />
          <FormField id="approach-channel" label="Canal">
            <NativeSelect id="approach-channel" value={channel} onChange={(event) => setChannel(event.target.value as DealInteractionChannel)}>
              <option value="" disabled>
                Selecione
              </option>
              {INTERACTION_CHANNELS.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_CHANNEL_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="approach-date" label="Data do contato">
              <Input id="approach-date" type="date" max={todayInAppZone()} value={date} onChange={(event) => setDate(event.target.value)} />
            </FormField>
            <FormField id="approach-time" label="Horário">
              <Input id="approach-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </FormField>
          </div>
          <FormField id="approach-summary" label="Observação">
            <Textarea id="approach-summary" rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </FormField>
          <FormField id="approach-reason" label="Motivo da correção (opcional)">
            <Input id="approach-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="lg" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" loading={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Riscar abordagem: continua visível, riscada; sai da cadência e da meta de toques. Motivo obrigatório. */
export function ApproachStrikeDialog({ item, onOpenChange, onDone }: ApproachDialogProps) {
  const { pending, failure, submit } = useSubmit(onDone, onOpenChange);
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);

  return (
    <Dialog open onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Riscar este registro?</DialogTitle>
          <DialogDescription>
            {item.summary ?? item.body} · {formatDateTime(item.occurred_at)}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O registro continua no histórico, riscado, e deixa de contar na cadência e na meta de toques. Só a diretoria vê o motivo.
        </p>
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <FormField id="strike-reason" label="Motivo" error={missing ? "Informe o motivo para riscar o registro." : undefined}>
          <Textarea
            id="strike-reason"
            rows={2}
            value={reason}
            aria-invalid={missing}
            onChange={(event) => {
              setReason(event.target.value);
              setMissing(false);
            }}
          />
        </FormField>
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
            onClick={() => (reason.trim().length < 3 ? setMissing(true) : submit(() => strikeApproachAction({ id: item.id, reason })))}
          >
            Riscar registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
