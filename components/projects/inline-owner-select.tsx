"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateProjectAction } from "@/app/(app)/projetos/actions";
import { OwnerSelect } from "@/components/projects/owner-select";

interface InlineOwnerSelectProps {
  projectId: string;
  value: string;
  members: { id: string; full_name: string }[];
  disabled: boolean;
}

export function InlineOwnerSelect({ projectId, value, members, disabled }: InlineOwnerSelectProps) {
  const [pending, startTransition] = useTransition();

  return (
    <OwnerSelect
      id={`owner-${projectId}`}
      value={value}
      members={members}
      disabled={disabled || pending}
      onChange={(next) =>
        startTransition(async () => {
          const result = await updateProjectAction(projectId, { ownerId: next });
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    />
  );
}
