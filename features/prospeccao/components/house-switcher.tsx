"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useSave } from "@/features/prospeccao/components/use-save";
import { switchHousePlaybookAction } from "@/features/prospeccao/house-actions";

/** Cliente da casa: escolher a outra sugestão de playbook antes do primeiro envio. */
export function HouseSwitcher({ dealId, current, options }: { dealId: string; current: string; options: { id: string; name: string }[] }) {
  const [choice, setChoice] = useState(current);
  const { pending, run } = useSave();
  const id = `casa-${dealId}`;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <label htmlFor={id} className="w-full text-[13px] font-semibold text-muted-foreground">
        Playbook do cliente da casa (dá para trocar até o primeiro envio)
      </label>
      <NativeSelect id={id} className="h-11 min-w-0 flex-1" value={choice} onChange={(event) => setChoice(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
      <Button type="button" variant="secondary" size="lg" disabled={choice === current} loading={pending} onClick={() => run(() => switchHousePlaybookAction(dealId, choice))}>
        Trocar
      </Button>
    </div>
  );
}
