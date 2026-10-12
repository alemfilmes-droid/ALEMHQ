"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ProspectFieldsInputs } from "@/features/prospeccao/components/prospect-fields-inputs";
import { createProspectLeadAction } from "@/features/prospeccao/lead-actions";
import { quickLeadSchema, type ProspectFieldsValues, type QuickLeadValues } from "@/features/prospeccao/lead-schemas";
import type { ProspectFormOptions } from "@/features/prospeccao/types";

type Errors = Partial<Record<keyof QuickLeadValues, string>>;

const EMPTY: QuickLeadValues = {
  leadName: "",
  contactName: "",
  whatsapp: "",
  playbookId: "",
  leadType: "escola",
  contactIsDecisionMaker: true,
  decisionMakerName: "",
  decisionMakerRole: "",
  decisionMakerWhatsapp: "",
  hook: "",
  goalId: null,
  lastDeliveredProject: "",
};

function collectErrors(values: QuickLeadValues): Errors {
  const parsed = quickLeadSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: Errors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof QuickLeadValues;
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Cadastro rápido de prospecção: nome, contato, WhatsApp, playbook e gancho. O resto o HQ calcula. */
export function ProspectQuickForm({ options, onCreated, onCancel }: { options: ProspectFormOptions; onCreated: (dealId: string) => void; onCancel: () => void }) {
  const [values, setValues] = useState<QuickLeadValues>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = showErrors ? collectErrors(values) : {};
  const set = <K extends keyof QuickLeadValues>(key: K, value: QuickLeadValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    setError(null);
    if (Object.keys(collectErrors(values)).length) return;
    startTransition(async () => {
      const result = await createProspectLeadAction(values);
      if (result.ok && result.id) onCreated(result.id);
      else if (!result.ok) setError(result.error);
    });
  }

  if (options.playbooks.length === 0) {
    return <Alert title="Nenhum playbook ativo">Peça ao Anderson para ativar um playbook em Configurações › Prospecção.</Alert>;
  }

  const field = (key: "leadName" | "contactName" | "whatsapp", label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField id={`rapido-${key}`} label={label} error={errors[key]}>
      <Input
        id={`rapido-${key}`}
        className="h-11"
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={`rapido-${key}-message`}
        {...props}
      />
    </FormField>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field("leadName", "Escola ou empresa", { maxLength: 120 })}</div>
        {field("contactName", "Nome do contato", { maxLength: 120 })}
        {field("whatsapp", "WhatsApp", { type: "tel", inputMode: "tel", maxLength: 20, placeholder: "(84) 99999-9999" })}
      </div>
      <ProspectFieldsInputs
        idPrefix="rapido"
        values={values}
        onChange={(next: ProspectFieldsValues) => setValues((current) => ({ ...current, ...next }))}
        options={options}
        errors={errors}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" loading={pending}>
          Cadastrar lead
        </Button>
      </div>
    </form>
  );
}
