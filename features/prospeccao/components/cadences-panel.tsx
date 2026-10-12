"use client";

import { useState } from "react";
import { Plus, Repeat, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSave } from "@/features/prospeccao/components/use-save";
import { CADENCE_TYPE_LABELS } from "@/features/prospeccao/labels";
import { cadenceSchema } from "@/features/prospeccao/schemas";
import { saveCadenceAction } from "@/features/prospeccao/settings-actions";
import type { ProspectCadence } from "@/types";

/** Aba Cadências: dias úteis de cada toque e prazo de reativação, por tipo. */
export function CadencesPanel({ cadences, usage }: { cadences: ProspectCadence[]; usage: Record<string, string[]> }) {
  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Os dias contam em dias úteis a partir do Toque 1 (fim de semana e feriado são pulados). A reativação conta em dias corridos depois do
        último toque sem resposta. Ao adicionar um toque, escreva o script dele na aba Scripts.
      </p>
      {cadences.map((cadence) => (
        <CadenceCard key={cadence.cadence_type} cadence={cadence} playbooks={usage[cadence.cadence_type] ?? []} />
      ))}
    </div>
  );
}

function CadenceCard({ cadence, playbooks }: { cadence: ProspectCadence; playbooks: string[] }) {
  const [offsets, setOffsets] = useState<number[]>(cadence.touch_offsets);
  const [reactivationDays, setReactivationDays] = useState(cadence.reactivation_days);
  const { pending, run } = useSave();
  const parsed = cadenceSchema.safeParse({ cadenceType: cadence.cadence_type, touchOffsets: offsets, reactivationDays });
  const error = parsed.success ? null : (parsed.error.issues[0]?.message ?? "Revise os dias.");
  const id = `cadencia-${cadence.cadence_type}`;

  return (
    <Card variant="static">
      <CardHeading icon={Repeat} tone="slate" title={`${CADENCE_TYPE_LABELS[cadence.cadence_type]} · ${offsets.length} toques`} />
      <CardContent className="space-y-5">
        <p className="text-[13px] text-muted-foreground">Usada em: {playbooks.length ? playbooks.join(", ") : "nenhum playbook"}.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {offsets.map((offset, index) => (
            <li key={index} className="flex items-end gap-2">
              <FormField id={`${id}-${index}`} label={`Toque ${index + 1} · dia útil`} className="flex-1">
                <Input
                  id={`${id}-${index}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="h-11"
                  value={Number.isNaN(offset) ? "" : offset}
                  readOnly={index === 0}
                  onChange={(event) =>
                    setOffsets(offsets.map((value, i) => (i === index ? (event.target.value === "" ? Number.NaN : Number(event.target.value)) : value)))
                  }
                />
              </FormField>
              {index > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  aria-label={`Remover toque ${index + 1}`}
                  onClick={() => setOffsets(offsets.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={offsets.length >= 12}
          onClick={() => setOffsets([...offsets, (offsets.at(-1) ?? 0) + 5])}
        >
          <Plus aria-hidden />
          Adicionar toque
        </Button>
        <div className="max-w-xs">
          <FormField id={`${id}-reativacao`} label="Sem resposta, reativa em (dias)">
            <Input
              id={`${id}-reativacao`}
              type="number"
              inputMode="numeric"
              min={1}
              className="h-11"
              value={Number.isNaN(reactivationDays) ? "" : reactivationDays}
              onChange={(event) => setReactivationDays(event.target.value === "" ? Number.NaN : Number(event.target.value))}
            />
          </FormField>
        </div>
        {error ? <p className="text-[13px] font-semibold text-foreground">{error}</p> : null}
        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            loading={pending}
            disabled={Boolean(error)}
            onClick={() => run(() => saveCadenceAction({ cadenceType: cadence.cadence_type, touchOffsets: offsets, reactivationDays }))}
          >
            <Save aria-hidden />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
