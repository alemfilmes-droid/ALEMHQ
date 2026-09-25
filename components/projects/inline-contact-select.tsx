"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateProjectAction } from "@/app/(app)/projetos/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "none";

interface InlineContactSelectProps {
  projectId: string;
  value: string | null;
  contacts: { id: string; full_name: string }[];
  disabled: boolean;
}

export function InlineContactSelect({ projectId, value, contacts, disabled }: InlineContactSelectProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled || pending}
      onValueChange={(next) =>
        startTransition(async () => {
          const result = await updateProjectAction(projectId, { contactId: next === NONE ? null : next });
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <SelectTrigger aria-label="Contato" className="h-9">
        <SelectValue placeholder="Sem contato" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sem contato</SelectItem>
        {contacts.map((contact) => (
          <SelectItem key={contact.id} value={contact.id}>
            {contact.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
