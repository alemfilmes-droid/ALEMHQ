"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPayableAction, updatePayableAction } from "@/features/finance/actions";
import { PayableFields, payableValuesFrom } from "@/features/finance/components/payable-fields";
import { payableSchema, type PayableValues } from "@/features/finance/schemas";
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

function initialValues(props: PayableDialogProps): PayableValues {
  if (props.mode === "edit") return payableValuesFrom(props.payable);
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
    payeePixKeyType: "",
    payeePixKey: "",
    payeeHolderName: "",
    payeeDocument: "",
    payeeBankName: "",
    payeeBankAgency: "",
    payeeBankAccount: "",
    payeeAccountType: "",
    commissionGoalId: "",
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
  const form = useForm<PayableValues>({ resolver: zodResolver(payableSchema), defaultValues: initialValues(props) });
  const { handleSubmit, reset, watch } = form;
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

          <PayableFields form={form} options={props.options} lockedProjectId={props.lockedProjectId} showFutureNote={generatesFutureOccurrences} />

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
