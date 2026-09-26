"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProjectAction, getProjectDeleteSummaryAction, type ProjectDeleteSummary } from "@/app/(app)/projetos/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * "Apagar projeto" (master, diretoria e heads). Mostra o que vai junto e pede o nome do projeto para
 * confirmar — é irreversível. O banco confere de novo (can_delete_project).
 */
export function DeleteProjectDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<ProjectDeleteSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setConfirmName("");
    setError(null);
    getProjectDeleteSummaryAction(projectId).then((data) => {
      if (!active) return;
      setSummary(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, projectId]);

  const matches = confirmName.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR") === projectName.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  const blocked = summary !== null && !summary.canDelete;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectAction({ id: projectId, confirmName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.replace("/projetos");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2 aria-hidden />
          Apagar projeto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apagar projeto?</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">“{projectName}”</span> será apagado. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        {loading || !summary ? (
          <div className="space-y-2" role="status" aria-label="Carregando">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">Vai junto com o projeto:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li>{plural(summary.pautas, "pauta", "pautas")} (com responsáveis, comentários e histórico)</li>
                <li>A equipe do projeto ({plural(summary.members, "pessoa", "pessoas")}) e o contrato</li>
              </ul>
            </div>
            {summary.commitments > 0 || summary.hasFinanceRecords ? (
              <div>
                <p className="font-semibold">Fica no sistema, sem o projeto:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {summary.commitments > 0 ? <li>{plural(summary.commitments, "compromisso", "compromissos")} da agenda</li> : null}
                  {summary.hasFinanceRecords ? (
                    <li>
                      {summary.receivables != null && summary.payables != null
                        ? `${plural(summary.receivables, "recebimento", "recebimentos")} e ${plural(summary.payables, "pagamento", "pagamentos")} no financeiro`
                        : "Lançamentos no financeiro"}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {blocked ? (
              <Alert variant="error">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Este projeto já tem lançamentos no financeiro. Só quem tem acesso ao financeiro pode apagá-lo.
                </span>
              </Alert>
            ) : (
              <FormField id="delete-project-name" label="Para confirmar, digite o nome do projeto">
                <Input
                  id="delete-project-name"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  placeholder={projectName}
                  autoComplete="off"
                />
              </FormField>
            )}
            {error ? <Alert variant="error">{error}</Alert> : null}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={confirm} loading={pending} disabled={!summary || blocked || !matches}>
            <Trash2 aria-hidden />
            Apagar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
