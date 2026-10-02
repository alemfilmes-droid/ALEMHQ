"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_LABELS } from "@/features/finance/labels";
import { savePaymentDetailsAction } from "@/features/goals/actions";
import { paymentDetailsSchema, type PaymentDetailsValues } from "@/features/goals/schemas";
import {
  BANK_ACCOUNT_TYPES,
  BANK_ACCOUNT_TYPE_LABELS,
  PAYOUT_METHODS,
  PIX_KEY_TYPES,
  PIX_KEY_TYPE_LABELS,
  type PaymentDetailsItem,
} from "@/features/goals/types";
import { formatDateTime } from "@/lib/format";

function defaults(details: PaymentDetailsItem | null, fullName: string): PaymentDetailsValues {
  return {
    preferredMethod: details?.preferredMethod === "transferencia" ? "transferencia" : "pix",
    holderName: details?.holderName ?? fullName,
    holderDocument: details?.holderDocument ?? "",
    pixKeyType: details?.pixKeyType ?? "",
    pixKey: details?.pixKey ?? "",
    bankName: details?.bankName ?? "",
    bankCode: details?.bankCode ?? "",
    agency: details?.agency ?? "",
    accountNumber: details?.accountNumber ?? "",
    accountType: details?.accountType ?? "",
    notes: details?.notes ?? "",
  };
}

/** Dados para receber salário, comissão e pró-labore. Só a pessoa edita; o financeiro lê. */
export function PaymentDetailsForm({ details, fullName }: { details: PaymentDetailsItem | null; fullName: string }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentDetailsValues>({ resolver: zodResolver(paymentDetailsSchema), defaultValues: defaults(details, fullName) });
  const method = useWatch({ control, name: "preferredMethod" });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await savePaymentDetailsAction(values);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="pg-forma" label="Como prefere receber">
          <NativeSelect id="pg-forma" {...register("preferredMethod")}>
            {PAYOUT_METHODS.map((item) => (
              <option key={item} value={item}>
                {PAYMENT_METHOD_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="hidden sm:block" />
        <FormField id="pg-titular" label="Nome do titular" error={errors.holderName?.message}>
          <Input id="pg-titular" autoComplete="name" aria-invalid={!!errors.holderName} {...register("holderName")} />
        </FormField>
        <FormField id="pg-documento" label="CPF ou CNPJ do titular" error={errors.holderDocument?.message}>
          <Input id="pg-documento" inputMode="numeric" {...register("holderDocument")} />
        </FormField>
      </div>

      <fieldset className="space-y-4">
        <legend className="eyebrow mb-2">Pix {method === "pix" ? "" : "(opcional)"}</legend>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <FormField id="pg-pix-tipo" label="Tipo da chave" error={errors.pixKeyType?.message}>
            <NativeSelect id="pg-pix-tipo" aria-invalid={!!errors.pixKeyType} {...register("pixKeyType")}>
              <option value="">Escolha…</option>
              {PIX_KEY_TYPES.map((item) => (
                <option key={item} value={item}>
                  {PIX_KEY_TYPE_LABELS[item]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="pg-pix" label="Chave Pix" error={errors.pixKey?.message}>
            <Input id="pg-pix" aria-invalid={!!errors.pixKey} {...register("pixKey")} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="eyebrow mb-2">Conta bancária {method === "transferencia" ? "" : "(opcional)"}</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <FormField id="pg-banco" label="Banco">
            <Input id="pg-banco" placeholder="Nubank, Itaú…" {...register("bankName")} />
          </FormField>
          <FormField id="pg-banco-codigo" label="Código">
            <Input id="pg-banco-codigo" inputMode="numeric" placeholder="260" {...register("bankCode")} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="pg-agencia" label="Agência">
            <Input id="pg-agencia" inputMode="numeric" {...register("agency")} />
          </FormField>
          <FormField id="pg-conta" label="Conta com dígito" error={errors.accountNumber?.message}>
            <Input id="pg-conta" aria-invalid={!!errors.accountNumber} {...register("accountNumber")} />
          </FormField>
          <FormField id="pg-tipo-conta" label="Tipo de conta">
            <NativeSelect id="pg-tipo-conta" {...register("accountType")}>
              <option value="">—</option>
              {BANK_ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {BANK_ACCOUNT_TYPE_LABELS[item]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </fieldset>

      <FormField id="pg-obs" label="Observações (opcional)" error={errors.notes?.message}>
        <Textarea id="pg-obs" rows={2} placeholder="Ex.: pró-labore na conta PJ." {...register("notes")} />
      </FormField>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-subtle">{details ? `Atualizado em ${formatDateTime(details.updatedAt)}` : "Ainda não cadastrado."}</p>
        <Button type="submit" loading={pending}>
          Salvar dados de pagamento
        </Button>
      </div>
    </form>
  );
}
