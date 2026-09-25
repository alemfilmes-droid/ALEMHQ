"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateProjectAction } from "@/app/(app)/projetos/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import type { ProjectPriority } from "@/types";

export function InlinePrioritySelect({ projectId, value, disabled }: { projectId: string; value: ProjectPriority; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      disabled={disabled || pending}
      onValueChange={(next) =>
        startTransition(async () => {
          const result = await updateProjectAction(projectId, { priority: next as ProjectPriority });
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <SelectTrigger aria-label="Prioridade" className="h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((item) => (
          <SelectItem key={item} value={item}>
            {PRIORITY_LABELS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
