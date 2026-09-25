"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OwnerSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  members: { id: string; full_name: string }[];
  invalid?: boolean;
  disabled?: boolean;
}

export function OwnerSelect({ id, value, onChange, members, invalid, disabled }: OwnerSelectProps) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue placeholder="Selecione o responsável" />
      </SelectTrigger>
      <SelectContent>
        {members.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            {member.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
