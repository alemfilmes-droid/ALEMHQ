"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/finance/labels";
import type { PaymentMethod } from "@/types";

const NONE = "none";

interface MethodSelectProps {
  id: string;
  value: PaymentMethod | "";
  onChange: (value: PaymentMethod | "") => void;
  /** Com `optional`, oferece "Não informada". Sem, exige escolha. */
  optional?: boolean;
  invalid?: boolean;
}

export function MethodSelect({ id, value, onChange, optional = false, invalid }: MethodSelectProps) {
  return (
    <Select
      value={value === "" ? (optional ? NONE : undefined) : value}
      onValueChange={(next) => onChange(next === NONE ? "" : (next as PaymentMethod))}
    >
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        {optional ? <SelectItem value={NONE}>Não informada</SelectItem> : null}
        {PAYMENT_METHODS.map((method) => (
          <SelectItem key={method} value={method}>
            {PAYMENT_METHOD_LABELS[method]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
