"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useLifecycleSubmit } from "@/features/clients/components/close-flow/use-lifecycle-submit";
import { DependencyList } from "@/features/clients/components/deletion/dependency-list";
import { deleteClientAction, deletionSummaryAction } from "@/features/clients/deletion-actions";
import { confirmationMatches, type DeletionSummary } from "@/lib/clients/deletion";
import { formatDateTime } from "@/lib/format";

interface DeleteClientDialogProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
}

/**
 * "Excluir cliente" (só a conta master). Mostra o que está ligado ao cliente. Sem histórico: apaga de
 * vez digitando o nome exato. Com histórico: vai para a Lixeira — nada é apagado e o financeiro não muda.
 */
export function DeleteClientDialog({ companyId, companyName, onClose }: DeleteClientDialogProps) {
  const router = useRouter();
  const { pending, failure, submit } = useLifecycleSubmit(() => {
    onClose();
    router.push("/clientes");
  });
  const [summary, setSummary] = useState<DeletionSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [reason, setReason] = useState("");
  const [cancelIds, setCancelIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    deletionSummaryAction(companyId)
      .then((result) => {
        if (!active) return;
        if (!result.ok) return setLoadError(result.error);
        setSummary(result.summary);
        setCancelIds(result.summary.meetings.map((meeting) => meeting.id));
      })
      .catch(() => active && setLoadError("Não foi possível carregar o resumo. Verifique a internet e tente de novo."));
    return () => {
      active = false;
    };
  }, [companyId]);

  const permanent = summary !== null && !summary.has_dependencies;
  const canSubmit = summary !== null && (!permanent || confirmationMatches(typedName, companyName));
  const toggleMeeting = (id: string) => setCancelIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Excluir cliente.</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>

        {loadError ? <ActionError message={loadError} /> : null}
        {!summary && !loadError ? (
          <div className="space-y-2" aria-label="Carregando o resumo do cliente">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : null}

        {summary && permanent ? (
          <div className="space-y-4">
            <p className="text-sm">
              Este cliente não tem nenhum histórico no HQ{summary.contacts > 0 ? ` (só ${summary.contacts === 1 ? "1 contato" : `${summary.contacts} contatos`})` : ""}.
              Ele será <strong>apagado permanentemente</strong>, junto com os contatos.
            </p>
            <p className="rounded-md border-2 border-[var(--status-danger)] p-3 text-sm font-semibold">Isso não tem volta.</p>
            <FormField id="delete-confirm-name" label={`Para confirmar, digite o nome do cliente: ${companyName}`}>
              <Input id="delete-confirm-name" autoComplete="off" value={typedName} onChange={(event) => setTypedName(event.target.value)} />
            </FormField>
          </div>
        ) : null}

        {summary && !permanent ? (
          <div className="space-y-4">
            <p className="text-sm">
              Este cliente tem histórico no HQ, então <strong>nada será apagado</strong>: ele vai para a <strong>Lixeira</strong> (Clientes → Lixeira), de onde
              você pode restaurar.
            </p>
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="eyebrow">Ligado a este cliente</p>
              <DependencyList counts={summary} />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>Some de Clientes, do CRM, do “Chamar hoje”, de Projetos, de Pautas e das listas de escolha.</li>
              <li>Os negócios são arquivados e a cadência para.</li>
              <li>Projetos e pautas em aberto são finalizados (“Encerrado — cliente excluído”).</li>
              <li>O financeiro não muda: os lançamentos continuam nos relatórios como “{companyName} (cliente excluído)”.</li>
            </ul>

            {summary.meetings.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Reuniões futuras: marque as que devem ser canceladas</legend>
                <p className="text-[12px] text-muted-foreground">As canceladas saem da agenda e do Google Agenda de quem conectou a conta.</p>
                <ul className="space-y-1 rounded-md border border-border p-2">
                  {summary.meetings.map((meeting) => (
                    <li key={meeting.id}>
                      <label className="flex min-h-11 items-start gap-3 py-1 text-[13px]">
                        <Checkbox className="mt-0.5 size-5" checked={cancelIds.includes(meeting.id)} onCheckedChange={() => toggleMeeting(meeting.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold">{meeting.title}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatDateTime(meeting.starts_at)}
                            {meeting.owner ? ` · ${meeting.owner}` : ""}
                            {meeting.on_google ? " · no Google Agenda" : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}

            <FormField id="delete-reason" label="Motivo (opcional)">
              <Textarea id="delete-reason" rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
            </FormField>
          </div>
        ) : null}

        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          {summary ? (
            <Button
              type="button"
              size="lg"
              loading={pending}
              disabled={!canSubmit}
              onClick={() =>
                submit(() =>
                  deleteClientAction({ companyId, confirmName: permanent ? typedName : "", reason, cancelCommitmentIds: permanent ? [] : cancelIds }),
                )
              }
            >
              {permanent ? "Excluir permanentemente" : "Excluir cliente"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
