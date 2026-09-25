"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createReceivableAction, updateReceivableAction } from "@/features/finance/actions";
import { MethodSelect } from "@/features/finance/components/method-select";
import { centsToInput, formatCents, parseMoneyToCents, splitInstallments } from "@/features/finance/money";
import { receivableSchema, type ReceivableValues } from "@/features/finance/schemas";
import type { FinanceOptions, ReceivableItem } from "@/features/finance/types";
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
import { Textarea } from "@/components/ui/textarea";

type ReceivableDialogProps = {
  options: FinanceOptions;
  today: string;
  trigger?: ReactNode;
  /** Modo controlado (menu de ações da tabela): sem gatilho próprio. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pré-preenchimento (ex.: aba Financeiro do projeto ou da empresa). */
  defaults?: { companyId?: string; projectId?: string };
} & ({ mode: "create" } | { mode: "edit"; receivable: ReceivableItem });

const NO_PROJECT = "none";

function initialValues(props: ReceivableDialogProps): ReceivableValues {
  if (props.mode === "edit") {
    const item = props.receivable;
    return {
      companyId: item.companyId,
      projectId: item.projectId ?? "",
      description: item.description,
      serviceDescription: item.serviceDescription ?? "",
      competenceMonth: item.competenceMonth ?? "",
      amount: centsToInput(item.amount),
      installments: "1",
      intervalDays: "30",
      dueDate: item.dueDate,
      paymentMethod: item.paymentMethod ?? "",
      invoiceNumber: item.invoiceNumber ?? "",
      notes: item.notes ?? "",
    };
  }
  return {
    companyId: props.defaults?.companyId ?? "",
    projectId: props.defaults?.projectId ?? "",
    description: "",
    serviceDescription: "",
    competenceMonth: "",
    amount: "",
    installments: "1",
    intervalDays: "30",
    dueDate: props.today,
    paymentMethod: "",
    invoiceNumber: "",
    notes: "",
  };
}

export function ReceivableDialog(props: ReceivableDialogProps) {
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
  } = useForm<ReceivableValues>({ resolver: zodResolver(receivableSchema), defaultValues: initialValues(props) });

  const companyId = watch("companyId");
  const installments = Number(watch("installments")) || 1;
  const amountCents = parseMoneyToCents(watch("amount"));
  const projectOptions = props.options.projects.filter((project) => project.company_id === companyId);
  const parcelled = !isEdit && installments > 1;
  const preview = parcelled && amountCents && amountCents > 0 ? splitInstallments(amountCents, installments) : null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(initialValues(props));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result =
        props.mode === "edit" ? await updateReceivableAction(props.receivable.id, values) : await createReceivableAction(values);
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
            <Button>
              <Plus aria-hidden />
              Novo recebimento
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar recebimento." : "Novo recebimento."}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Só recebimentos em aberto podem ser editados." : "Para parcelar, informe o número de parcelas e o valor total."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

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

          <div className="grid gap-5 sm:grid-cols-2">
            {isEdit ? null : (
              <FormField id="rec-installments" label="Parcelas" error={errors.installments?.message}>
                <Input id="rec-installments" inputMode="numeric" {...register("installments")} />
              </FormField>
            )}
            <FormField id="rec-amount" label={parcelled ? "Valor total (R$)" : "Valor (R$)"} error={errors.amount?.message}>
              <Input id="rec-amount" inputMode="decimal" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} />
            </FormField>
            <FormField id="rec-due" label={parcelled ? "Primeiro vencimento" : "Vencimento"} error={errors.dueDate?.message}>
              <Input id="rec-due" type="date" {...register("dueDate")} />
            </FormField>
            {parcelled ? (
              <FormField id="rec-interval" label="Intervalo (dias)" error={errors.intervalDays?.message}>
                <Input id="rec-interval" inputMode="numeric" {...register("intervalDays")} />
              </FormField>
            ) : null}
            <FormField id="rec-method" label="Forma de pagamento">
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => <MethodSelect id="rec-method" optional value={field.value} onChange={field.onChange} />}
              />
            </FormField>
            {parcelled ? null : (
              <FormField id="rec-invoice" label="Nota fiscal" error={errors.invoiceNumber?.message}>
                <Input id="rec-invoice" {...register("invoiceNumber")} />
              </FormField>
            )}
          </div>

          {preview ? (
            <p className="rounded-md border border-border bg-surface-raised p-3 text-[13px] text-muted-foreground">
              {installments} parcelas de {formatCents(preview[preview.length - 1] ?? 0)}
              {preview[0] !== preview[preview.length - 1] ? ` (as primeiras com ${formatCents(preview[0] ?? 0)})` : ""}. Soma:{" "}
              <span className="font-bold text-foreground">{formatCents(amountCents ?? 0)}</span>.
            </p>
          ) : null}

          {parcelled ? null : (
            <FormField id="rec-notes" label="Observações" error={errors.notes?.message}>
              <Textarea id="rec-notes" {...register("notes")} />
            </FormField>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {isEdit ? "Salvar" : parcelled ? "Gerar parcelas" : "Criar recebimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
