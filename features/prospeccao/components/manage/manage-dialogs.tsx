"use client";

import { useState, type ReactNode } from "react";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useLifecycleSubmit } from "@/features/clients/components/close-flow/use-lifecycle-submit";
import {
  editCadenceAction,
  eraseProspectingAction,
  removeFromProspectingAction,
  restartCadenceAction,
  type ManageOptions,
} from "@/features/prospeccao/manage-actions";
import { confirmationMatches } from "@/lib/clients/deletion";
import type { ActionResult } from "@/types";

export type ManageKind = "editar" | "reiniciar" | "remover" | "apagar";

interface DialogProps {
  dealId: string;
  options: ManageOptions;
  onClose: () => void;
}

/** Moldura comum: título, explicação em português simples, erro visível e Voltar/confirmar. */
function Frame({
  title,
  leadName,
  confirm,
  disabled,
  run,
  onClose,
  children,
}: {
  title: string;
  leadName: string;
  confirm: string;
  disabled?: boolean;
  run: () => Promise<ActionResult>;
  onClose: () => void;
  children: ReactNode;
}) {
  const { pending, failure, submit } = useLifecycleSubmit(onClose);
  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{leadName}</DialogDescription>
        </DialogHeader>
        {children}
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" loading={pending} disabled={disabled} onClick={() => submit(run)}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlaybookField({ id, value, onChange, playbooks }: { id: string; value: string; onChange: (value: string) => void; playbooks: ManageOptions["playbooks"] }) {
  return (
    <FormField id={id} label="Playbook">
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Escolha…</option>
        {playbooks.map((playbook) => (
          <option key={playbook.id} value={playbook.id}>
            {playbook.name} ({playbook.touches} toques)
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
}

export function EditCadenceDialog({ dealId, options, onClose }: DialogProps) {
  const [playbookId, setPlaybookId] = useState(options.current.playbookId ?? "");
  const total = options.playbooks.find((playbook) => playbook.id === playbookId)?.touches ?? 0;
  const [touch, setTouch] = useState(options.current.touch ?? 1);
  const [due, setDue] = useState(options.current.nextDue && options.current.nextDue >= options.today ? options.current.nextDue : options.today);
  return (
    <Frame
      title="Editar cadência."
      leadName={options.leadName}
      confirm="Salvar cadência"
      disabled={!playbookId || touch > total || !due}
      run={() => editCadenceAction({ dealId, playbookId, touch, due })}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        O próximo envio passa a ser o toque e o dia escolhidos (em dia útil). Depois dele, a cadência segue normal. Os toques já enviados continuam no histórico.
      </p>
      <PlaybookField id="manage-edit-playbook" value={playbookId} onChange={setPlaybookId} playbooks={options.playbooks} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="manage-edit-touch" label="Próximo toque">
          <NativeSelect id="manage-edit-touch" value={String(touch)} onChange={(event) => setTouch(Number(event.target.value))}>
            {Array.from({ length: total + 1 }, (_, index) => (
              <option key={index} value={index}>
                {index === 0 ? "Toque 0 (falar com o decisor)" : `Toque ${index}`}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="manage-edit-due" label="Data do próximo toque">
          <Input id="manage-edit-due" type="date" min={options.today} value={due} onChange={(event) => setDue(event.target.value)} />
        </FormField>
      </div>
    </Frame>
  );
}

export function RestartCadenceDialog({ dealId, options, onClose }: DialogProps) {
  const [playbookId, setPlaybookId] = useState(options.current.playbookId ?? "");
  return (
    <Frame
      title="Reiniciar cadência."
      leadName={options.leadName}
      confirm="Reiniciar"
      disabled={!playbookId}
      run={() => restartCadenceAction(dealId, playbookId)}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        A cadência recomeça hoje do Toque 1 (ou do Toque 0, se o lead ainda não tem decisor). Os toques antigos ficam no histórico como “ciclo anterior” e
        não contam no ciclo novo.
      </p>
      <PlaybookField id="manage-restart-playbook" value={playbookId} onChange={setPlaybookId} playbooks={options.playbooks} />
    </Frame>
  );
}

export function RemoveProspectingDialog({ dealId, options, onClose }: DialogProps) {
  return (
    <Frame title="Remover da prospecção." leadName={options.leadName} confirm="Remover" run={() => removeFromProspectingAction(dealId)} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        O lead sai da cadência, do “Chamar hoje” e da lista de Prospecção. O negócio continua no funil do CRM e o histórico fica. Para voltar, use “Reiniciar
        cadência”.
      </p>
    </Frame>
  );
}

export function EraseProspectingDialog({ dealId, options, onClose }: DialogProps) {
  const [typed, setTyped] = useState("");
  return (
    <Frame
      title="Apagar prospecção."
      leadName={options.leadName}
      confirm="Apagar prospecção"
      disabled={!confirmationMatches(typed, options.leadName)}
      run={() => eraseProspectingAction(dealId, typed)}
      onClose={onClose}
    >
      <p className="rounded-md border-2 border-[var(--status-danger)] p-3 text-sm">
        Apaga de vez os toques enviados (e os registros de tentativa deles na linha do tempo), as objeções, os rascunhos pendentes e os dados da cadência
        deste lead. As metas de toques se ajustam sozinhas. O negócio continua no funil do CRM. Isso não tem volta.
      </p>
      <FormField id="manage-erase-confirm" label={`Para confirmar, digite o nome do lead: ${options.leadName}`}>
        <Input id="manage-erase-confirm" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
      </FormField>
    </Frame>
  );
}
