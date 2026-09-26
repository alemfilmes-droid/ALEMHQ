"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/avatar";

interface MemberPickerProps {
  idPrefix: string;
  value: string[];
  onChange: (value: string[]) => void;
  members: { id: string; full_name: string; avatar_url: string | null }[];
  legend?: string;
}

/** Membros da equipe do projeto, além do responsável (que já entra automaticamente). */
export function MemberPicker({ idPrefix, value, onChange, members, legend = "Membros do projeto" }: MemberPickerProps) {
  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((current) => current !== id));
  }

  if (members.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Nenhuma pessoa ativa disponível.</p>;
  }

  return (
    <fieldset className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
      <legend className="sr-only">{legend}</legend>
      {members.map((member) => {
        const id = `${idPrefix}-${member.id}`;
        return (
          <div key={member.id} className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-surface-hover">
            <Checkbox id={id} checked={value.includes(member.id)} onCheckedChange={(checked) => toggle(member.id, checked === true)} />
            <UserAvatar name={member.full_name} src={member.avatar_url} profileId={member.id} className="size-6" />
            <Label htmlFor={id} className="flex-1 cursor-pointer text-[13px] font-normal">
              {member.full_name}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}
