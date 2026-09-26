"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { updateDealAction } from "@/features/crm/actions";
import { PROSPECTION_GOALS, PROSPECTION_GOAL_LABELS } from "@/features/crm/labels";
import type { DealFormOptions } from "@/features/crm/types";
import { centsToInput, toCents } from "@/features/finance/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { DealWithDetails, ProspectionGoal } from "@/types";

interface DealFieldsFormProps {
  deal: DealWithDetails;
  options: DealFormOptions;
  canManageAll: boolean;
  onSaved: () => void;
}

interface FieldsValues {
  primaryContactId: string;
  ownerId: string;
  estimatedValue: string;
  expectedCloseDate: string;
  goals: ProspectionGoal[];
}

export function DealFieldsForm({ deal, options, canManageAll, onSaved }: DealFieldsFormProps) {
  const [pending, startTransition] = useTransition();
  const { canSeeFinance } = useCrmFlow();
  const companyContacts = options.contacts.filter((contact) => contact.company_id === deal.company_id);
  // O valor acompanha a proposta mais recente (regra do banco): só se edita à mão antes de haver proposta.
  const valueLocked = deal.latest_proposal_amount != null;
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FieldsValues>({
    defaultValues: {
      primaryContactId: deal.primary_contact_id ?? "",
      ownerId: deal.owner_id ?? "",
      estimatedValue: deal.estimated_value != null ? centsToInput(toCents(deal.estimated_value)) : "",
      expectedCloseDate: deal.expected_close_date ?? "",
      goals: deal.prospection_goals ?? [],
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateDealAction(deal.id!, {
        primaryContactId: values.primaryContactId,
        ownerId: canManageAll ? values.ownerId : undefined,
        estimatedValue: valueLocked || !canSeeFinance ? undefined : values.estimatedValue,
        expectedCloseDate: values.expectedCloseDate,
        goals: values.goals.length > 0 ? values.goals : undefined,
      });
      if (result.ok) {
        toast.success("Salvo.");
        reset(values);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <FormField id="deal-contact" label="Contato">
        <NativeSelect id="deal-contact" {...register("primaryContactId")}>
          <option value="">Sem contato definido</option>
          {companyContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.full_name}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField id="deal-owner" label="SDR (dono do lead)">
        {canManageAll ? (
          <NativeSelect id="deal-owner" {...register("ownerId")}>
            {options.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <p className="flex h-10 items-center text-sm font-semibold">{deal.owner_name}</p>
        )}
      </FormField>

      {canSeeFinance ? (
        <FormField id="deal-value" label="Valor estimado (R$)" hint={valueLocked ? "Acompanha a proposta mais recente." : undefined}>
          <Input id="deal-value" inputMode="decimal" placeholder="0,00" readOnly={valueLocked} {...register("estimatedValue")} />
        </FormField>
      ) : null}

      <FormField id="deal-close-date" label="Previsão de fechamento">
        <Input id="deal-close-date" type="date" {...register("expectedCloseDate")} />
      </FormField>

      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">Objetivo da prospecção</legend>
        <Controller
          control={control}
          name="goals"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {PROSPECTION_GOALS.map((goal) => (
                <div key={goal} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <Checkbox
                    id={`goal-${goal}`}
                    checked={field.value.includes(goal)}
                    onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, goal] : field.value.filter((item) => item !== goal))}
                  />
                  <Label htmlFor={`goal-${goal}`} className="flex-1 cursor-pointer font-normal">
                    {PROSPECTION_GOAL_LABELS[goal]}
                  </Label>
                </div>
              ))}
            </div>
          )}
        />
      </fieldset>

      <Button type="submit" size="sm" loading={pending} disabled={!isDirty} className="sm:col-span-2 sm:w-fit">
        Salvar alterações
      </Button>
    </form>
  );
}
