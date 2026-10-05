"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { SearchSelect } from "@/components/ui/search-select";
import { startRunAction } from "@/features/processes/actions";
import { DriveFolderTool, type DriveProjectOption } from "@/features/processes/components/drive-folder-tool";
import { InvoiceFileTool, type InvoiceReceivableOption } from "@/features/processes/components/invoice-file-tool";
import type { ProcessStepItem } from "@/features/processes/types";

const NO_PROJECT = "__sem_projeto__";

/** Ferramenta embutida no passo (pasta do Drive, árvore de pastas, arquivo da nota fiscal). */
export function StepTools({
  step,
  projects,
  receivables,
  contextProjectId,
}: {
  step: ProcessStepItem;
  projects: DriveProjectOption[];
  receivables: InvoiceReceivableOption[];
  contextProjectId?: string | null;
}) {
  if (step.tool === "pasta_drive") return <DriveFolderTool projects={projects} initialProjectId={contextProjectId} />;
  if (step.tool === "arvore_drive") return <DriveFolderTool projects={projects} initialProjectId={contextProjectId} variant="tree" />;
  if (step.tool === "arquivo_nota_fiscal") return <InvoiceFileTool receivables={receivables} />;
  return null;
}

/** "Iniciar execução": opcionalmente ligada a um projeto, para o histórico. */
export function StartRunDialog({
  processId,
  projects,
  onOpenChange,
  onStarted,
}: {
  processId: string;
  projects: DriveProjectOption[];
  onOpenChange: (open: boolean) => void;
  onStarted?: () => void;
}) {
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [pending, startTransition] = useTransition();

  function start() {
    const project = projects.find((item) => item.id === projectId);
    startTransition(async () => {
      const result = await startRunAction(processId, project ? { projectId: project.id, label: `${project.name} · ${project.clientName}` } : null);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        onStarted?.();
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar execução.</DialogTitle>
          <DialogDescription>Cada passo concluído registra quem fez e quando. Ao concluir, vai para o histórico.</DialogDescription>
        </DialogHeader>
        <FormField id="run-project" label="Projeto (opcional)" hint="Para saber depois a que esta execução se refere.">
          <SearchSelect
            id="run-project"
            value={projectId}
            onChange={setProjectId}
            options={[{ value: NO_PROJECT, label: "Sem projeto" }, ...projects.map((item) => ({ value: item.id, label: `${item.name} · ${item.clientName}` }))]}
            placeholder="Escolha"
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={start} loading={pending}>
            <Play aria-hidden />
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
