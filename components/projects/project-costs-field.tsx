"use client";

import { Controller, useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYABLE_CATEGORIES, PAYABLE_CATEGORY_LABELS } from "@/features/finance/labels";
import type { ProjectValues } from "@/lib/validations/project";

interface ProjectCostsFieldProps {
  control: Control<ProjectValues>;
  register: UseFormRegister<ProjectValues>;
  errors: FieldErrors<ProjectValues>;
}

/** Bloco repetível "Custos previstos": cada linha vira um pagamento (payable) ao criar o projeto. */
export function ProjectCostsField({ control, register, errors }: ProjectCostsFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "costs" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Custos previstos</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => append({ description: "", category: "outro", amount: "", dueDate: "" })}
        >
          <Plus aria-hidden />
          Adicionar custo
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhum custo previsto ainda.</p>
      ) : (
        <ul className="space-y-3">
          {fields.map((field, index) => {
            const rowErrors = errors.costs?.[index];
            return (
              <li key={field.id} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] sm:items-start rounded-md border border-border p-3">
                <FormField id={`cost-desc-${field.id}`} label="Descrição" error={rowErrors?.description?.message}>
                  <Input id={`cost-desc-${field.id}`} {...register(`costs.${index}.description`)} />
                </FormField>
                <FormField id={`cost-cat-${field.id}`} label="Categoria" error={rowErrors?.category?.message}>
                  <Controller
                    control={control}
                    name={`costs.${index}.category`}
                    render={({ field: categoryField }) => (
                      <Select value={categoryField.value} onValueChange={categoryField.onChange}>
                        <SelectTrigger id={`cost-cat-${field.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYABLE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {PAYABLE_CATEGORY_LABELS[category]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField id={`cost-amount-${field.id}`} label="Valor (R$)" error={rowErrors?.amount?.message}>
                  <Input id={`cost-amount-${field.id}`} inputMode="decimal" placeholder="0,00" {...register(`costs.${index}.amount`)} />
                </FormField>
                <FormField id={`cost-due-${field.id}`} label="Vencimento" hint="Opcional." error={rowErrors?.dueDate?.message}>
                  <Input id={`cost-due-${field.id}`} type="date" {...register(`costs.${index}.dueDate`)} />
                </FormField>
                <Button type="button" variant="ghost" size="icon" className="justify-self-end sm:mt-6" onClick={() => remove(index)} aria-label="Remover custo">
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
