"use client";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AUDIENCES } from "@/features/prospeccao/labels";
import type { ProspectFieldsValues } from "@/features/prospeccao/lead-schemas";
import type { ProspectFormOptions } from "@/features/prospeccao/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const NONE = "";

interface Props {
  idPrefix: string;
  values: ProspectFieldsValues;
  onChange: (values: ProspectFieldsValues) => void;
  options: ProspectFormOptions;
  /** Edição: mostra tipo de lead e último projeto entregue (no cadastro rápido vêm do playbook / Módulo 5). */
  full?: boolean;
  errors?: Partial<Record<keyof ProspectFieldsValues, string>>;
}

/** Campos de prospecção do lead: playbook, gancho, meta sugerida, quem decide e o decisor. */
export function ProspectFieldsInputs({ idPrefix, values, onChange, options, full = false, errors = {} }: Props) {
  const set = <K extends keyof ProspectFieldsValues>(key: K, value: ProspectFieldsValues[K]) => onChange({ ...values, [key]: value });
  const id = (name: string) => `${idPrefix}-${name}`;
  const staleGoal = values.goalId !== null && !options.goals.some((goal) => goal.id === values.goalId);

  function choosePlaybook(playbookId: string) {
    const playbook = options.playbooks.find((item) => item.id === playbookId);
    // A meta e o tipo de lead vêm sugeridos pelo playbook; dá para trocar depois.
    onChange({
      ...values,
      playbookId,
      leadType: playbook?.audience ?? values.leadType,
      goalId: playbook?.suggestedGoalId && options.goals.some((goal) => goal.id === playbook.suggestedGoalId) ? playbook.suggestedGoalId : null,
    });
  }

  const choice = (active: boolean) =>
    cn(
      "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold",
      active ? "border-foreground text-foreground" : "border-border text-muted-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={id("playbook")} label="Playbook" error={errors.playbookId}>
          <NativeSelect id={id("playbook")} className="h-11" value={values.playbookId} onChange={(event) => choosePlaybook(event.target.value)}>
            <option value="" disabled>
              Escolha o playbook
            </option>
            {options.playbooks.map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                {playbook.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id={id("meta")} label="Meta vinculada" hint="Sugerida pelo playbook.">
          <NativeSelect
            id={id("meta")}
            className="h-11"
            value={values.goalId ?? NONE}
            onChange={(event) => set("goalId", event.target.value || null)}
            aria-describedby={`${id("meta")}-message`}
          >
            <option value={NONE}>Nenhuma</option>
            {staleGoal ? <option value={values.goalId ?? NONE}>Meta encerrada</option> : null}
            {options.goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title} · até {formatDate(goal.endsOn)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {full ? (
          <FormField id={id("tipo")} label="Tipo de lead">
            <NativeSelect
              id={id("tipo")}
              className="h-11"
              value={values.leadType}
              onChange={(event) => set("leadType", event.target.value as ProspectFieldsValues["leadType"])}
            >
              {AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {audience === "escola" ? "Escola" : "Empresa"}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : null}
        <FormField
          id={id("gancho")}
          label="Gancho"
          hint={`Opcional. Ex.: "vi que vocês abriram a unidade de Parnamirim". ${values.hook.length}/120`}
          error={errors.hook}
          className={full ? undefined : "sm:col-span-2"}
        >
          <Input
            id={id("gancho")}
            className="h-11"
            maxLength={120}
            value={values.hook}
            onChange={(event) => set("hook", event.target.value)}
            aria-describedby={`${id("gancho")}-message`}
          />
        </FormField>
        {full ? (
          <FormField id={id("ultimo-projeto")} label="Último projeto entregue" hint="Preenchido = cliente da casa (o Toque 1 usa o script dele).">
            <Input
              id={id("ultimo-projeto")}
              className="h-11"
              maxLength={160}
              value={values.lastDeliveredProject}
              onChange={(event) => set("lastDeliveredProject", event.target.value)}
              aria-describedby={`${id("ultimo-projeto")}-message`}
            />
          </FormField>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">O contato atual é quem decide?</legend>
        <div className="flex gap-2">
          {[true, false].map((answer) => (
            <label key={String(answer)} className={choice(values.contactIsDecisionMaker === answer)}>
              <input
                type="radio"
                name={id("decide")}
                className="sr-only"
                checked={values.contactIsDecisionMaker === answer}
                onChange={() => set("contactIsDecisionMaker", answer)}
              />
              {answer ? "Sim" : "Não"}
            </label>
          ))}
        </div>
        {!values.contactIsDecisionMaker ? (
          <p className="text-[13px] text-muted-foreground">
            Sem o decisor, o lead começa no Toque 0 (pedir o contato de quem decide). Preencha agora ou depois.
          </p>
        ) : null}
      </fieldset>

      {!values.contactIsDecisionMaker || full ? (
        <div className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
          <p className="text-sm font-semibold text-foreground sm:col-span-3">Decisor {values.contactIsDecisionMaker ? "" : "(opcional por enquanto)"}</p>
          <FormField id={id("decisor-nome")} label="Nome" error={errors.decisionMakerName}>
            <Input id={id("decisor-nome")} className="h-11" maxLength={120} value={values.decisionMakerName} onChange={(event) => set("decisionMakerName", event.target.value)} />
          </FormField>
          <FormField id={id("decisor-cargo")} label="Cargo" error={errors.decisionMakerRole}>
            <Input id={id("decisor-cargo")} className="h-11" maxLength={80} value={values.decisionMakerRole} onChange={(event) => set("decisionMakerRole", event.target.value)} />
          </FormField>
          <FormField id={id("decisor-whatsapp")} label="WhatsApp" error={errors.decisionMakerWhatsapp}>
            <Input
              id={id("decisor-whatsapp")}
              className="h-11"
              type="tel"
              inputMode="tel"
              maxLength={20}
              value={values.decisionMakerWhatsapp}
              onChange={(event) => set("decisionMakerWhatsapp", event.target.value)}
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
