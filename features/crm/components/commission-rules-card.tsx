"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveCommissionRuleAction } from "@/features/crm/actions";
import type { CommissionRuleRow } from "@/features/crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface Values {
  padrao: string;
  reaquecido: string;
}

const format = (value: number | undefined) => (value === undefined ? "" : String(value).replace(".", ","));

/** Regras de comissão (só master/diretoria editam — a RLS repete a regra). Cada edição vira uma nova regra vigente a partir de agora. */
export function CommissionRulesCard({ rules }: { rules: CommissionRuleRow[] }) {
  const [pending, startTransition] = useTransition();
  const current = (kind: CommissionRuleRow["kind"]) => rules.find((rule) => rule.kind === kind)?.percent;
  const {
    register,
    handleSubmit,
    formState: { isDirty },
    reset,
  } = useForm<Values>({ defaultValues: { padrao: format(current("padrao")), reaquecido: format(current("reaquecido")) } });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      for (const kind of ["padrao", "reaquecido"] as const) {
        if (values[kind] === format(current(kind))) continue;
        const result = await saveCommissionRuleAction({ kind, percent: values[kind] });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("Regras de comissão atualizadas.");
      reset(values);
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comissão do SDR</CardTitle>
        <p className="text-xs text-subtle">Percentual sobre o valor da última proposta (ou do contrato). Vale para os negócios daqui em diante e para os em aberto.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-4">
          <FormField id="commission-padrao" label="Padrão (%)">
            <Input id="commission-padrao" inputMode="decimal" className="w-28" {...register("padrao")} />
          </FormField>
          <FormField id="commission-reaquecido" label="Lead reaquecido (%)">
            <Input id="commission-reaquecido" inputMode="decimal" className="w-28" {...register("reaquecido")} />
          </FormField>
          <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!isDirty}>
            Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
