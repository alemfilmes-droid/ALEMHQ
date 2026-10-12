"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import type { ReceivableValues } from "@/features/finance/schemas";
import type { FinanceOptions } from "@/features/finance/types";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_PROJECT = "none";

/** Campos de identificação do recebimento — os mesmos em criar, editar e editar recebimento já baixado. */
export type ReceivableIdentityValues = Pick<ReceivableValues, "companyId" | "projectId" | "description" | "serviceDescription" | "competenceMonth">;

export function ReceivableIdentityFields({ form, options }: { form: UseFormReturn<ReceivableIdentityValues>; options: FinanceOptions }) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const companyId = watch("companyId");
  const projectOptions = options.projects.filter((project) => project.company_id === companyId);

  return (
    <>
      <FormField id="rec-company" label="Cliente" error={errors.companyId?.message}>
        <Controller
          control={control}
          name="companyId"
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={(value) => {
                field.onChange(value);
                setValue("projectId", "");
              }}
            >
              <SelectTrigger id="rec-company" aria-invalid={!!errors.companyId}>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {options.companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <FormField id="rec-project" label="Projeto" hint="Opcional. Sem projeto, é um trabalho avulso.">
        <Controller
          control={control}
          name="projectId"
          render={({ field }) => (
            <Select
              value={field.value || NO_PROJECT}
              onValueChange={(value) => field.onChange(value === NO_PROJECT ? "" : value)}
              disabled={!companyId}
            >
              <SelectTrigger id="rec-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>Sem projeto</SelectItem>
                {projectOptions.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <FormField id="rec-description" label="Descrição" error={errors.description?.message}>
        <Input id="rec-description" aria-invalid={!!errors.description} aria-describedby={errors.description ? "rec-description-message" : undefined} {...register("description")} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="rec-service" label="Descrição do serviço" hint="Opcional." error={errors.serviceDescription?.message}>
          <Input id="rec-service" {...register("serviceDescription")} />
        </FormField>
        <FormField id="rec-competence" label="Mês de competência" hint="Para clientes recorrentes.">
          <Controller
            control={control}
            name="competenceMonth"
            render={({ field }) => (
              <Input
                id="rec-competence"
                type="month"
                value={field.value ? field.value.slice(0, 7) : ""}
                onChange={(event) => field.onChange(event.target.value ? `${event.target.value}-01` : "")}
              />
            )}
          />
        </FormField>
      </div>
    </>
  );
}
