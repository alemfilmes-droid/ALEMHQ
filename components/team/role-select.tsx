"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCESS_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import type { AccessRole } from "@/types";

interface RoleSelectProps {
  id: string;
  value: AccessRole | undefined;
  onChange: (value: AccessRole) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function RoleSelect({ id, value, onChange, disabled, invalid }: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as AccessRole)} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid} aria-describedby={invalid ? `${id}-message` : undefined}>
        <SelectValue placeholder="Selecione o papel" />
      </SelectTrigger>
      <SelectContent>
        {ACCESS_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
