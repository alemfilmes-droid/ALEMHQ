"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from "@/lib/domain";
import type { ServiceType } from "@/types";

interface ServiceTypePickerProps {
  idPrefix: string;
  value: ServiceType[];
  onChange: (value: ServiceType[]) => void;
}

export function ServiceTypePicker({ idPrefix, value, onChange }: ServiceTypePickerProps) {
  function toggle(item: ServiceType, checked: boolean) {
    onChange(checked ? [...value, item] : value.filter((current) => current !== item));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">Tipos de serviço</legend>
      <div className="grid grid-cols-2 gap-2">
        {SERVICE_TYPES.map((item) => {
          const id = `${idPrefix}-${item}`;
          return (
            <div key={item} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Checkbox id={id} checked={value.includes(item)} onCheckedChange={(checked) => toggle(item, checked === true)} />
              <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                {SERVICE_TYPE_LABELS[item]}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
