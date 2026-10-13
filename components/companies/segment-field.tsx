"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OTHER_SEGMENT, SEGMENTS, segmentChoice, segmentValue } from "@/lib/clients/segment";

const NONE = "none";

/** "Segmento": lista fixa + "Outro" com texto livre. O valor do formulário é o texto que vai para o banco. */
export function SegmentField({ value, onChange, error }: { value: string; onChange: (next: string) => void; error?: string }) {
  const initial = segmentChoice(value);
  const [option, setOption] = useState<string>(initial.option);
  const [custom, setCustom] = useState(initial.custom);

  return (
    <div className="space-y-3">
      <FormField id="company-segment" label="Segmento" error={error}>
        <Select
          value={option || NONE}
          onValueChange={(next) => {
            const selected = next === NONE ? "" : next;
            setOption(selected);
            onChange(segmentValue(selected, custom));
          }}
        >
          <SelectTrigger id="company-segment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Não informado</SelectItem>
            {SEGMENTS.map((segment) => (
              <SelectItem key={segment} value={segment}>
                {segment}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_SEGMENT}>Outro</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {option === OTHER_SEGMENT ? (
        <FormField id="company-segment-other" label="Qual segmento?" hint="Ex.: moda, academia, indústria.">
          <Input
            id="company-segment-other"
            maxLength={80}
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value);
              onChange(segmentValue(OTHER_SEGMENT, event.target.value));
            }}
          />
        </FormField>
      ) : null}
    </div>
  );
}
