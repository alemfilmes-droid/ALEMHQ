"use client";

import { useState } from "react";
import { EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { ActionError } from "@/components/ui/action-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useLifecycleSubmit } from "@/features/clients/components/close-flow/use-lifecycle-submit";
import { DependencyList } from "@/features/clients/components/deletion/dependency-list";
import { anonymizeClientAction, purgeClientAction, restoreClientAction } from "@/features/clients/deletion-actions";
import type { TrashItem } from "@/features/clients/deletion-queries";
import { CONFIRM_ANONYMIZE, confirmationMatches, purgeBlocker } from "@/lib/clients/deletion";
import { formatDateTime } from "@/lib/format";
import type { ActionResult } from "@/types";

type Pending = { kind: "restore" | "purge" | "anonymize"; item: TrashItem } | null;

const COPY = {
  restore: {
    title: "Restaurar cliente.",
    button: "Restaurar",
    body: "O cliente e os negócios dele voltam a aparecer. Projetos e pautas continuam finalizados: se precisar, reative cada um à mão.",
  },
  purge: {
    title: "Excluir definitivamente.",
    button: "Excluir definitivamente",
    body: "Apaga o cliente com contatos, negócios (e o histórico de abordagens), projetos, pautas, reuniões e orçamentos. Isso não tem volta.",
  },
  anonymize: {
    title: "Anonimizar (LGPD).",
    button: "Anonimizar",
    body: "Troca por “Removido” o nome do cliente, documento, site e Instagram, os contatos (nome, telefone, e-mail), o gancho e o decisor do CRM, as mensagens e as observações. Valores, datas e categorias ficam. Isso não tem volta.",
  },
} as const;

/** Uma janela de confirmação por ação; exclusão definitiva pede o nome exato, anonimizar pede ANONIMIZAR. */
function ConfirmDialog({ pending: target, onClose }: { pending: NonNullable<Pending>; onClose: () => void }) {
  const { pending, failure, submit } = useLifecycleSubmit(onClose);
  const [typed, setTyped] = useState("");
  const copy = COPY[target.kind];
  const expected = target.kind === "purge" ? target.item.name : target.kind === "anonymize" ? CONFIRM_ANONYMIZE : null;
  const confirmed = expected === null || (target.kind === "anonymize" ? typed.trim() === CONFIRM_ANONYMIZE : confirmationMatches(typed, expected));
  const run = (): Promise<ActionResult> =>
    target.kind === "restore"
      ? restoreClientAction(target.item.id)
      : target.kind === "purge"
        ? purgeClientAction(target.item.id, typed)
        : anonymizeClientAction(target.item.id, typed.trim());

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{target.item.name}</DialogDescription>
        </DialogHeader>
        <p className={target.kind === "restore" ? "text-sm" : "rounded-md border-2 border-[var(--status-danger)] p-3 text-sm"}>{copy.body}</p>
        {expected ? (
          <FormField id="trash-confirm" label={`Para confirmar, digite: ${expected}`}>
            <Input id="trash-confirm" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
          </FormField>
        ) : null}
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" loading={pending} disabled={!confirmed} onClick={() => submit(run)}>
            {copy.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Aba "Lixeira" em Clientes (só a conta master): restaurar, excluir definitivamente ou anonimizar. */
export function TrashList({ items }: { items: TrashItem[] }) {
  const [pending, setPending] = useState<Pending>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
        <Trash2 className="mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="font-bold">A Lixeira está vazia.</p>
        <p className="mt-1 text-sm text-muted-foreground">Clientes excluídos com histórico aparecem aqui.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((item) => {
          const blocker = purgeBlocker(item.counts);
          const anonymized = item.anonymized_at !== null;
          return (
            <li key={item.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <ClientAvatar name={item.name} logoUrl={item.logo_url} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {item.name}
                    {anonymized ? <Badge variant="outline">Anonimizado</Badge> : null}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Excluído em {formatDateTime(item.deleted_at)}
                    {item.deleted_by ? ` por ${item.deleted_by}` : ""}
                  </p>
                  {item.reason ? <p className="mt-1 text-[13px]">Motivo: {item.reason}</p> : null}
                </div>
              </div>
              <DependencyList counts={item.counts} />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!anonymized ? (
                  <Button type="button" variant="secondary" size="lg" className="sm:h-9" onClick={() => setPending({ kind: "restore", item })}>
                    <RotateCcw aria-hidden />
                    Restaurar
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" size="lg" className="sm:h-9" disabled={blocker !== null} onClick={() => setPending({ kind: "purge", item })}>
                  <Trash2 aria-hidden />
                  Excluir definitivamente
                </Button>
                {!anonymized ? (
                  <Button type="button" variant="secondary" size="lg" className="sm:h-9" onClick={() => setPending({ kind: "anonymize", item })}>
                    <EyeOff aria-hidden />
                    Anonimizar (LGPD)
                  </Button>
                ) : null}
              </div>
              {blocker ? <p className="text-[12px] text-muted-foreground">{blocker}</p> : null}
            </li>
          );
        })}
      </ul>
      {pending ? <ConfirmDialog key={`${pending.kind}-${pending.item.id}`} pending={pending} onClose={() => setPending(null)} /> : null}
    </>
  );
}
