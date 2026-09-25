"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { saveFinancialsAction } from "@/app/(app)/projetos/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { financialsSchema, type FinancialsValues } from "@/lib/validations/project";

export function FinancialsForm({ projectId, defaultValues }: { projectId: string; defaultValues: FinancialsValues }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FinancialsValues>({ resolver: zodResolver(financialsSchema), defaultValues });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveFinancialsAction(projectId, values);
      if (result.ok) {
        toast.success(result.message);
        reset(values);
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
      <FormField id="fin-value" label="Valor do contrato (R$)" error={errors.contractValue?.message}>
        <Input id="fin-value" inputMode="decimal" placeholder="0,00" {...register("contractValue")} />
      </FormField>
      <FormField id="fin-terms" label="Condições de pagamento" error={errors.paymentTerms?.message}>
        <Textarea id="fin-terms" {...register("paymentTerms")} />
      </FormField>
      <Button type="submit" loading={pending} disabled={!isDirty}>
        Salvar financeiro
      </Button>
    </form>
  );
}
