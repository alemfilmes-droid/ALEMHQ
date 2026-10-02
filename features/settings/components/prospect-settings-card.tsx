"use client";

import { useState, useTransition } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { saveProspectSettingsAction } from "@/features/settings/prospect-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AUTO = "__automatico__";

/**
 * Prospecção automática: 30 dias depois de um projeto finalizado, o SDR recebe a tarefa de
 * reativar o cliente (5 dias úteis). Quem valida aprova a estratégia antes da abordagem.
 */
export function ProspectSettingsCard({
  members,
  initial,
}: {
  members: { id: string; full_name: string }[];
  initial: { sdrId: string | null; reviewerId: string | null };
}) {
  const [sdrId, setSdrId] = useState(initial.sdrId ?? AUTO);
  const [reviewerId, setReviewerId] = useState(initial.reviewerId ?? AUTO);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveProspectSettingsAction({ sdrId: sdrId === AUTO ? null : sdrId, reviewerId: reviewerId === AUTO ? null : reviewerId });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  const select = (id: string, value: string, onChange: (value: string) => void, autoLabel: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>{autoLabel}</SelectItem>
        {members.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            {member.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card variant="static">
      <CardHeading icon={Target} tone="alert" title="Prospecção automática de clientes" />
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          30 dias depois que um projeto é finalizado, o SDR recebe uma tarefa para reativar o cliente, com prazo de 5 dias úteis. Antes de abordar,
          ele valida a estratégia e o produto com quem você escolher aqui.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="prospect-sdr" label="SDR (líder e responsável)">
            {select("prospect-sdr", sdrId, setSdrId, "Automático: primeira pessoa do comercial")}
          </FormField>
          <FormField id="prospect-reviewer" label="Quem valida a estratégia">
            {select("prospect-reviewer", reviewerId, setReviewerId, "Automático: head do comercial (ou master)")}
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={save} loading={pending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
