"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { MethodSelect } from "@/features/finance/components/method-select";
import { MANUAL_PAYABLE_CATEGORIES, PAYABLE_CATEGORY_LABELS, PAYABLE_RECURRENCES, PAYABLE_RECURRENCE_LABELS } from "@/features/finance/labels";
import { PAYABLE_COST_TYPES, type PayableCostType, type PayableValues } from "@/features/finance/schemas";
import { centsToInput } from "@/features/finance/money";
import type { FinanceOptions, PayableItem } from "@/features/finance/types";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PayeePaymentDetails } from "@/features/goals/components/payee-payment-details";
import { BANK_ACCOUNT_TYPE_LABELS, BANK_ACCOUNT_TYPES, PIX_KEY_TYPE_LABELS, PIX_KEY_TYPES } from "@/features/goals/types";
import { useTeamCategory } from "@/features/finance/components/use-team-category";
import { CATEGORY_LOCK_NOTES, TEAM_PAYMENT_TYPE_LABELS, teamTypeOf } from "@/lib/finance/team-category";
import { isDateOnly } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { payoutDateFor } from "@/lib/wallet/payout-date";

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
    commissionGoalId: item.commissionGoalId ?? "",
    isProLabore: item.isProLabore,
    isReimbursement: item.isReimbursement,
    teamPaymentType: teamTypeOf(item.category, item.teamPaymentType) ?? "",
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
  const team = useTeamCategory(form);
  const commission = team.teamType === "comissao";
  const goalsOfPayee = options.commissionGoals.filter((goal) => goal.ownerId === payeeProfileId);
  const payee = options.members.find((member) => member.id === payeeProfileId);
  const dueDate = watch("dueDate");
  // Data em que cai na Carteira do favorecido (mesma regra do banco: lib/wallet/payout-date).
  const payoutHint =
    payee && isDateOnly(dueDate) ? `Cai na Carteira de ${payee.full_name} em ${formatDate(payee.payday ? payoutDateFor(dueDate, payee.payday) : dueDate)}.` : null;
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
        <FormField
          id="pay-category"
          label="Categoria"
          error={errors.category?.message}
          hint={team.lock ? CATEGORY_LOCK_NOTES[team.lock] : undefined}
        >
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange} disabled={team.lock !== null}>
                <SelectTrigger id="pay-category" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_PAYABLE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {PAYABLE_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField id="pay-payee" label={commission ? "Beneficiário da comissão" : "Favorecido"} error={errors.payeeProfileId?.message}>
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

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <Controller
            control={control}
            name="isProLabore"
            render={({ field }) => (
              <Checkbox className="size-5" aria-label="Pró-labore" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            )}
          />
          Pró-labore
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <Controller
            control={control}
            name="isReimbursement"
            render={({ field }) => (
              <Checkbox
                className="size-5"
                aria-label="Reembolso de despesa"
                checked={field.value}
                disabled={team.isProLabore}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          Reembolso de despesa
        </label>
      </div>
      {team.isReimbursement && !team.isProLabore ? (
        <p className="text-[12px] text-muted-foreground">
          Reembolso fica em “Outro” e não conta como pagamento à equipe. Ligado a um cliente ou projeto, sai dos custos da empresa.
        </p>
      ) : null}

      {team.teamType ? (
        <FormField id="pay-team-type" label="Tipo (equipe e colaboradores)">
          <NativeSelect
            id="pay-team-type"
            value={team.teamType}
            disabled={team.teamType === "pro_labore"}
            onChange={(event) => setValue("teamPaymentType", event.target.value as typeof team.teamType, { shouldValidate: true })}
          >
            {team.typeOptions.map((type) => (
              <option key={type} value={type}>
                {TEAM_PAYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      ) : null}

      {commission ? (
        <div className="space-y-3 rounded-md border border-border-strong p-3">
          <p className="text-[13px] text-muted-foreground">
            Referente a: <strong className="text-foreground">Comissão</strong>. Ao salvar, a pessoa é avisada da data do pagamento (“Sua comissão de R$ X
            será paga em DD/MM”) e, depois da baixa, a meta mostra “Comissão paga”.
          </p>
          {payeeProfileId ? (
            <FormField id="pay-commission-goal" label="Meta (opcional)" hint="Liga o pagamento à meta batida. Sem meta, é uma comissão avulsa.">
              <NativeSelect id="pay-commission-goal" {...register("commissionGoalId")}>
                <option value="">Sem meta (comissão avulsa)</option>
                {goalsOfPayee.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
        </div>
      ) : null}

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
        <FormField id="pay-due" label="Vencimento" error={errors.dueDate?.message} hint={payoutHint ?? undefined}>
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
