"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPayableAction, updatePayableAction } from "@/features/finance/actions";
import { MethodSelect } from "@/features/finance/components/method-select";
import { PAYABLE_CATEGORIES, PAYABLE_CATEGORY_LABELS, PAYABLE_RECURRENCES, PAYABLE_RECURRENCE_LABELS } from "@/features/finance/labels";
import { centsToInput } from "@/features/finance/money";
import { payableSchema, PAYABLE_COST_TYPES, type PayableCostType, type PayableValues } from "@/features/finance/schemas";
import type { FinanceOptions, PayableItem } from "@/features/finance/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PayableDialogProps = {
  options: FinanceOptions;
  today: string;
  trigger?: ReactNode;
  /** Modo controlado (menu de ações da tabela): sem gatilho próprio. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Projeto fixo (aba Financeiro do projeto). */
  lockedProjectId?: string;
  /** Cliente pré-preenchido (aba Financeiro da empresa). */
  defaultCompanyId?: string;
  defaultCategory?: PayableValues["category"];
} & ({ mode: "create" } | { mode: "edit"; payable: PayableItem });

const NO_PROJECT = "none";
const EXTERNAL = "external";

const COST_TYPE_LABELS: Record<PayableCostType, string> = { empresa: "Custo da empresa", projeto: "Custo de projeto" };

function initialValues(props: PayableDialogProps): PayableValues {
  if (props.mode === "edit") {
    const item = props.payable;
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
    };
  }
  return {
    costType: props.lockedProjectId ? "projeto" : "empresa",
    projectId: props.lockedProjectId ?? "",
    companyId: props.defaultCompanyId ?? "",
    payeeProfileId: "",
    payeeName: "",
    category: props.defaultCategory ?? ("" as PayableValues["category"]),
    description: "",
    amount: "",
    dueDate: props.today,
    paymentMethod: "",
    notes: "",
    isFixed: false,
    recurrence: "none",
    recurrenceUntil: "",
  };
}

export function PayableDialog(props: PayableDialogProps) {
  const isEdit = props.mode === "edit";
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = props.open !== undefined;
  const open = controlled ? props.open === true : internalOpen;
  const setOpen = (next: boolean) => (controlled ? props.onOpenChange?.(next) : setInternalOpen(next));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PayableValues>({ resolver: zodResolver(payableSchema), defaultValues: initialValues(props) });
  const payeeProfileId = watch("payeeProfileId");
  const costType = watch("costType");
  const recurrence = watch("recurrence");
  const isRecurring = recurrence !== "none";
  const generatesFutureOccurrences = isRecurring && (!isEdit || !(props.mode === "edit" && props.payable.recurrenceParentId));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(initialValues(props));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = props.mode === "edit" ? await updatePayableAction(props.payable.id, values) : await createPayableAction(values);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlled ? null : (
        <DialogTrigger asChild>
          {props.trigger ?? (
            <Button variant="secondary">
              <Plus aria-hidden />
              Novo pagamento
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar pagamento." : props.lockedProjectId ? "Adicionar custo." : "Novo pagamento."}</DialogTitle>
          <DialogDescription>
            {props.lockedProjectId
              ? "O custo fica vinculado a este projeto."
              : "Escolha se é um custo da empresa ou de um projeto específico."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          {props.lockedProjectId ? null : (
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
                          {props.options.projects.map((project) => (
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
                          {props.options.companies.map((company) => (
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
                      {props.options.members.map((member) => (
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

          {payeeProfileId ? null : (
            <FormField id="pay-payee-name" label="Nome do favorecido" error={errors.payeeName?.message}>
              <Input id="pay-payee-name" aria-invalid={!!errors.payeeName} aria-describedby={errors.payeeName ? "pay-payee-name-message" : undefined} {...register("payeeName")} />
            </FormField>
          )}

          <FormField id="pay-description" label="Descrição" error={errors.description?.message}>
            <Input id="pay-description" aria-invalid={!!errors.description} aria-describedby={errors.description ? "pay-description-message" : undefined} {...register("description")} />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField id="pay-amount" label="Valor (R$)" error={errors.amount?.message}>
              <Input id="pay-amount" inputMode="decimal" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} />
            </FormField>
            <FormField id="pay-due" label="Vencimento" error={errors.dueDate?.message}>
              <Input id="pay-due" type="date" {...register("dueDate")} />
            </FormField>
            <FormField id="pay-form-method" label="Forma">
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => <MethodSelect id="pay-form-method" optional value={field.value} onChange={field.onChange} />}
              />
            </FormField>
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
            {isRecurring ? (
              <FormField id="pay-recurrence-until" label="Repetir até" error={errors.recurrenceUntil?.message} hint="Opcional; padrão de 12 meses.">
                <Input id="pay-recurrence-until" type="date" {...register("recurrenceUntil")} />
              </FormField>
            ) : null}
          </div>
          {generatesFutureOccurrences ? (
            <Alert variant="info">As próximas ocorrências são geradas automaticamente ao salvar.</Alert>
          ) : null}

          <FormField id="pay-notes" label="Observações" error={errors.notes?.message}>
            <Textarea id="pay-notes" {...register("notes")} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {isEdit ? "Salvar" : "Criar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
