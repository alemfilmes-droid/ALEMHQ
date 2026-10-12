"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { MethodSelect } from "@/features/finance/components/method-select";
import { PAYABLE_CATEGORIES, PAYABLE_CATEGORY_LABELS, PAYABLE_RECURRENCES, PAYABLE_RECURRENCE_LABELS } from "@/features/finance/labels";
import { PAYABLE_COST_TYPES, type PayableCostType, type PayableValues } from "@/features/finance/schemas";
import { centsToInput } from "@/features/finance/money";
import type { FinanceOptions, PayableItem } from "@/features/finance/types";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PayeePaymentDetails } from "@/features/goals/components/payee-payment-details";
import { BANK_ACCOUNT_TYPE_LABELS, BANK_ACCOUNT_TYPES, PIX_KEY_TYPE_LABELS, PIX_KEY_TYPES } from "@/features/goals/types";
import { cn } from "@/lib/utils";

const NO_PROJECT = "none";
const EXTERNAL = "external";

const COST_TYPE_LABELS: Record<PayableCostType, string> = { empresa: "Custo da empresa", projeto: "Custo de projeto" };

/** Valores do formulário a partir de um pagamento existente (editar em aberto ou já baixado). */
export function payableValuesFrom(item: PayableItem): PayableValues {
  return {
    costType: item.projectId ? "projeto" : "empresa",
    projectId: item.projectId ?? "",
    companyId: item.companyId ?? "",
    payeeProfileId: item.payeeProfileId ?? "",
    payeeName: item.payeeName ?? "",
    category: item.category,
    description: item.description,
    amount: centsToInput(item.amount),
    dueDate: item.dueDate,
    paymentMethod: item.paymentMethod ?? "",
    notes: item.notes ?? "",
    isFixed: item.isFixed,
    recurrence: item.recurrenceParentId ? "none" : item.recurrence,
    recurrenceUntil: item.recurrenceUntil ?? "",
    payeePixKeyType: item.payee.pixKeyType ?? "",
    payeePixKey: item.payee.pixKey ?? "",
    payeeHolderName: item.payee.holderName ?? "",
    payeeDocument: item.payee.document ?? "",
    payeeBankName: item.payee.bankName ?? "",
    payeeBankAgency: item.payee.agency ?? "",
    payeeBankAccount: item.payee.account ?? "",
    payeeAccountType: item.payee.accountType ?? "",
  };
}

interface PayableFieldsProps {
  form: UseFormReturn<PayableValues>;
  options: FinanceOptions;
  /** Projeto fixo (aba Financeiro do projeto). */
  lockedProjectId?: string;
  /** Lançamento já baixado: a forma de pagamento vai na seção da baixa; a recorrência é da série. */
  settled?: boolean;
  showFutureNote?: boolean;
}

/** Campos do pagamento — os mesmos em criar, editar e editar lançamento já baixado. */
export function PayableFields({ form, options, lockedProjectId, settled = false, showFutureNote = false }: PayableFieldsProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const payeeProfileId = watch("payeeProfileId");
  const costType = watch("costType");
  const isRecurring = watch("recurrence") !== "none";

  return (
    <>
      {lockedProjectId ? null : (
        <>
          <FormField id="pay-cost-type" label="Tipo de custo">
            <div role="radiogroup" aria-label="Tipo de custo" className="inline-flex w-full rounded-md border border-border-strong p-1">
              {PAYABLE_COST_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={costType === value}
                  onClick={() => {
                    setValue("costType", value, { shouldValidate: true });
                    if (value === "empresa") setValue("projectId", "");
                    else setValue("companyId", "");
                  }}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-sm font-semibold transition-colors",
                    costType === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {COST_TYPE_LABELS[value]}
                </button>
              ))}
            </div>
          </FormField>

          {costType === "projeto" ? (
            <FormField id="pay-project" label="Projeto" error={errors.projectId?.message}>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="pay-project" aria-invalid={!!errors.projectId}>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : (
            <FormField id="pay-company" label="Cliente" hint="Opcional. Vincula o custo a um cliente sem passar por um projeto.">
              <Controller
                control={control}
                name="companyId"
                render={({ field }) => (
                  <Select value={field.value || NO_PROJECT} onValueChange={(value) => field.onChange(value === NO_PROJECT ? "" : value)}>
                    <SelectTrigger id="pay-company">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>Despesa geral (sem cliente)</SelectItem>
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
          )}
        </>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="pay-category" label="Categoria" error={errors.category?.message}>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="pay-category" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Selecione" />
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

        <FormField id="pay-payee" label="Favorecido">
          <Controller
            control={control}
            name="payeeProfileId"
            render={({ field }) => (
              <Select
                value={field.value || EXTERNAL}
                onValueChange={(value) => {
                  field.onChange(value === EXTERNAL ? "" : value);
                  if (value !== EXTERNAL) setValue("payeeName", "");
                }}
              >
                <SelectTrigger id="pay-payee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EXTERNAL}>Outro (informar nome)</SelectItem>
                  {options.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      {payeeProfileId ? (
        <div className="space-y-1.5">
          <p className="text-[12px] text-muted-foreground">Dados para pagamento — vêm do perfil da pessoa (Perfil → Dados para pagamento).</p>
          <PayeePaymentDetails profileId={payeeProfileId} />
        </div>
      ) : (
        <>
          <FormField id="pay-payee-name" label="Nome do favorecido" error={errors.payeeName?.message}>
            <Input id="pay-payee-name" aria-invalid={!!errors.payeeName} aria-describedby={errors.payeeName ? "pay-payee-name-message" : undefined} {...register("payeeName")} />
          </FormField>
          <fieldset className="space-y-3 rounded-md border border-border p-3">
            <legend className="eyebrow px-1">Dados para pagamento (opcional, ficam salvos neste custo)</legend>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <FormField id="pay-pix-type" label="Tipo da chave Pix">
                <NativeSelect id="pay-pix-type" {...register("payeePixKeyType")}>
                  <option value="">—</option>
                  {PIX_KEY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PIX_KEY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="pay-pix" label="Chave Pix">
                <Input id="pay-pix" {...register("payeePixKey")} />
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="pay-holder" label="Titular">
                <Input id="pay-holder" {...register("payeeHolderName")} />
              </FormField>
              <FormField id="pay-document" label="CPF/CNPJ">
                <Input id="pay-document" inputMode="numeric" {...register("payeeDocument")} />
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <FormField id="pay-bank" label="Banco" className="sm:col-span-2">
                <Input id="pay-bank" {...register("payeeBankName")} />
              </FormField>
              <FormField id="pay-agency" label="Agência">
                <Input id="pay-agency" inputMode="numeric" {...register("payeeBankAgency")} />
              </FormField>
              <FormField id="pay-account" label="Conta">
                <Input id="pay-account" {...register("payeeBankAccount")} />
              </FormField>
            </div>
            <FormField id="pay-account-type" label="Tipo de conta" className="sm:max-w-[14rem]">
              <NativeSelect id="pay-account-type" {...register("payeeAccountType")}>
                <option value="">—</option>
                {BANK_ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {BANK_ACCOUNT_TYPE_LABELS[type]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </fieldset>
        </>
      )}

      <FormField id="pay-description" label="Descrição" error={errors.description?.message}>
        <Input id="pay-description" aria-invalid={!!errors.description} aria-describedby={errors.description ? "pay-description-message" : undefined} {...register("description")} />
      </FormField>

      <div className={cn("grid gap-5", settled ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        <FormField id="pay-amount" label="Valor (R$)" error={errors.amount?.message}>
          <Input id="pay-amount" inputMode="decimal" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} />
        </FormField>
        <FormField id="pay-due" label="Vencimento" error={errors.dueDate?.message}>
          <Input id="pay-due" type="date" {...register("dueDate")} />
        </FormField>
        {settled ? null : (
          <FormField id="pay-form-method" label="Forma">
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field }) => <MethodSelect id="pay-form-method" optional value={field.value} onChange={field.onChange} />}
            />
          </FormField>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Controller
            control={control}
            name="isFixed"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Custo fixo" />}
          />
          Custo fixo
        </label>
        {settled ? null : (
          <FormField id="pay-recurrence" label="Recorrência">
            <Controller
              control={control}
              name="recurrence"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="pay-recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYABLE_RECURRENCES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PAYABLE_RECURRENCE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        )}
        {isRecurring && !settled ? (
          <FormField id="pay-recurrence-until" label="Repetir até" error={errors.recurrenceUntil?.message} hint="Opcional; padrão de 12 meses.">
            <Input id="pay-recurrence-until" type="date" {...register("recurrenceUntil")} />
          </FormField>
        ) : null}
      </div>
      {showFutureNote ? (
        <Alert variant="info">As próximas ocorrências são geradas automaticamente ao salvar.</Alert>
      ) : null}

      <FormField id="pay-notes" label="Observações" error={errors.notes?.message}>
        <Textarea id="pay-notes" {...register("notes")} />
      </FormField>
    </>
  );
}
