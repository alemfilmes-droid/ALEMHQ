"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Flag } from "lucide-react";
import { toast } from "sonner";
import { finalizeProjectAction, getProjectFinalizationAction, type ProjectFinalizationStatus } from "@/features/projects/actions";
import { PROJECT_CHECK_EVENT } from "@/features/projects/finalize-events";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Pop-up de confirmação: finalizar o projeto (pronto) ou finalizar mesmo com pendências (manual). */
export function FinalizeProjectDialog({ status, open, onOpenChange }: { status: ProjectFinalizationStatus; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendencies = [
    status.pendingPautas > 0 ? plural(status.pendingPautas, "pauta ainda não aprovada", "pautas ainda não aprovadas") : null,
    status.openReceivables > 0 ? plural(status.openReceivables, "recebimento em aberto", "recebimentos em aberto") : null,
  ].filter(Boolean);

  function confirm() {
    startTransition(async () => {
      const result = await finalizeProjectAction(status.projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{status.ready ? "Projeto pronto para finalizar." : "Finalizar projeto."}</DialogTitle>
          <DialogDescription>{status.projectName}</DialogDescription>
        </DialogHeader>
        {status.ready ? (
          <p className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            Todas as pautas foram aprovadas e o pagamento foi recebido. Confirme que o projeto terminou.
          </p>
        ) : pendencies.length > 0 ? (
          <Alert>Ainda há {pendencies.join(" e ")}. Você pode finalizar assim mesmo, se o projeto já terminou.</Alert>
        ) : null}
        <p className="text-sm text-muted-foreground">
          30 dias depois da finalização, o comercial recebe automaticamente a tarefa de prospectar este cliente de novo.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Agora não
            </Button>
          </DialogClose>
          <Button type="button" onClick={confirm} loading={pending}>
            <Flag aria-hidden />
            Finalizar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Montado no layout do app: depois de uma baixa de recebimento ou aprovação de pauta, confere o
 * projeto e, se ficou pronto (pautas aprovadas + pagamento recebido), abre o pop-up de finalização
 * para quem pode finalizar.
 */
export function ProjectFinalizeWatcher() {
  const [status, setStatus] = useState<ProjectFinalizationStatus | null>(null);

  useEffect(() => {
    function onCheck(event: Event) {
      const projectId = (event as CustomEvent<string>).detail;
      void getProjectFinalizationAction(projectId).then((result) => {
        if (result && result.ready && result.canFinalize) setStatus(result);
      });
    }
    window.addEventListener(PROJECT_CHECK_EVENT, onCheck);
    return () => window.removeEventListener(PROJECT_CHECK_EVENT, onCheck);
  }, []);

  if (!status) return null;
  return <FinalizeProjectDialog status={status} open onOpenChange={(next) => !next && setStatus(null)} />;
}

/** Botão da página do projeto ("Finalizar projeto"); abre sozinho com ?finalizar=1 (vindo da notificação). */
export function FinalizeProjectButton({ projectId, autoOpen }: { projectId: string; autoOpen: boolean }) {
  const [status, setStatus] = useState<ProjectFinalizationStatus | null>(null);
  const [loading, startLoading] = useTransition();

  function open() {
    startLoading(async () => {
      const result = await getProjectFinalizationAction(projectId);
      if (result) setStatus(result);
    });
  }

  useEffect(() => {
    if (autoOpen) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abre uma vez ao chegar pela notificação
  }, [autoOpen]);

  return (
    <>
      <Button type="button" variant="secondary" onClick={open} loading={loading}>
        <Flag aria-hidden />
        Finalizar projeto
      </Button>
      {status ? <FinalizeProjectDialog status={status} open onOpenChange={(next) => !next && setStatus(null)} /> : null}
    </>
  );
}
