"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateProjectStageAction } from "@/app/(app)/projetos/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STAGES, STAGE_LABELS } from "@/lib/domain";
import type { ProjectStage } from "@/types";

export function StageSelect({ projectId, stage, disabled }: { projectId: string; stage: ProjectStage; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={stage}
      disabled={disabled || pending}
      onValueChange={(next) =>
        startTransition(async () => {
          const result = await updateProjectStageAction({ id: projectId, stage: next as ProjectStage });
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <SelectTrigger aria-label="Etapa do projeto" className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STAGES.map((item) => (
          <SelectItem key={item} value={item}>
            {STAGE_LABELS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
