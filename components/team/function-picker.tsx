"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FUNCTION_LABELS, PRODUCTION_FUNCTIONS } from "@/lib/auth/roles";
import type { ProductionFunction } from "@/types";

interface FunctionPickerProps {
  idPrefix: string;
  value: ProductionFunction[];
  onChange: (value: ProductionFunction[]) => void;
}

export function FunctionPicker({ idPrefix, value, onChange }: FunctionPickerProps) {
  function toggle(fn: ProductionFunction, checked: boolean) {
    onChange(checked ? [...value, fn] : value.filter((current) => current !== fn));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">Atuação (funções de produção)</legend>
      <div className="grid grid-cols-2 gap-2">
        {PRODUCTION_FUNCTIONS.map((fn) => {
          const id = `${idPrefix}-${fn}`;
          return (
            <div key={fn} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Checkbox id={id} checked={value.includes(fn)} onCheckedChange={(checked) => toggle(fn, checked === true)} />
              <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                {FUNCTION_LABELS[fn]}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
