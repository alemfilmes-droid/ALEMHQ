"use client";

import { useState } from "react";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLifecycleSubmit } from "@/features/clients/components/close-flow/use-lifecycle-submit";
import { clientPauseAction, clientReactivateAction } from "@/features/clients/lifecycle-actions";
import { todayInFortaleza } from "@/lib/pautas";

/** Pausar: projetos e pautas ficam pausados (não finalizados); o financeiro não muda. */
export function PauseClientDialog({ companyId, companyName, onClose }: { companyId: string; companyName: string; onClose: () => void }) {
  const { pending, failure, submit } = useLifecycleSubmit(onClose);
  const [description, setDescription] = useState("");
  const [closedAt, setClosedAt] = useState(todayInFortaleza());

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pausar cliente.</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Os projetos ativos e as pautas abertas ficam pausados (não são finalizados) e o cliente vai para Inativos como Pausado. O financeiro não muda.
          Ao reativar, você escolhe se eles voltam também.
        </p>
        <FormField id="pause-date" label="Data da pausa">
          <Input id="pause-date" type="date" value={closedAt} onChange={(event) => setClosedAt(event.target.value)} />
        </FormField>
        <FormField id="pause-description" label="Motivo da pausa">
          <Textarea id="pause-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </FormField>
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" loading={pending} disabled={description.trim().length < 10} onClick={() => submit(() => clientPauseAction({ companyId, description, closedAt, notes: "" }))}>
            Pausar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reativar. Pausado: pergunta se os projetos e pautas pausados voltam também. */
export function ReactivateClientDialog({ companyId, companyName, paused, onClose }: { companyId: string; companyName: string; paused: boolean; onClose: () => void }) {
  const { pending, failure, submit } = useLifecycleSubmit(onClose);
  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Reativar cliente.</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {paused
            ? "Os projetos e pautas foram pausados junto com o cliente. Eles devem voltar também?"
            : "O cliente volta para Clientes. Projetos encerrados e lançamentos cancelados continuam como estão."}
        </p>
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          {paused ? (
            <>
              <Button type="button" variant="secondary" size="lg" loading={pending} onClick={() => submit(() => clientReactivateAction(companyId, false))}>
                Só o cliente
              </Button>
              <Button type="button" size="lg" loading={pending} onClick={() => submit(() => clientReactivateAction(companyId, true))}>
                Cliente, projetos e pautas
              </Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="lg" disabled={pending}>
                  Voltar
                </Button>
              </DialogClose>
              <Button type="button" size="lg" loading={pending} onClick={() => submit(() => clientReactivateAction(companyId, false))}>
                Reativar cliente
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
