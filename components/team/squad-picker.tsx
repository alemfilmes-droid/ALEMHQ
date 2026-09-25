"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { SQUAD_LABELS, SQUADS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import type { Squad } from "@/types";

interface SquadPickerProps {
  idPrefix: string;
  value: Squad[];
  onChange: (value: Squad[]) => void;
}

export function SquadPicker({ idPrefix, value, onChange }: SquadPickerProps) {
  function toggle(squad: Squad, checked: boolean) {
    onChange(checked ? [...value, squad] : value.filter((current) => current !== squad));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">Squads</legend>
      <div className="grid grid-cols-2 gap-2">
        {SQUADS.map((squad) => {
          const id = `${idPrefix}-${squad}`;
          return (
            <div key={squad} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Checkbox id={id} checked={value.includes(squad)} onCheckedChange={(checked) => toggle(squad, checked === true)} />
              <Label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-1.5 font-normal">
                <StatusDot tone={SQUAD_TONE[squad]} />
                {SQUAD_LABELS[squad]}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
