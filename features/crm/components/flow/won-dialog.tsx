"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { closeDealWonAction } from "@/features/crm/actions";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { wonSchema, type WonValues } from "@/features/crm/schemas";
import type { DealFormOptions } from "@/features/crm/types";
import { centsToInput, toCents } from "@/features/finance/money";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MODEL_LABELS, MODELS, TIER_LABELS, TIERS } from "@/lib/domain";
import type { DealWithDetails } from "@/types";

interface WonDialogProps {
  deal: DealWithDetails;
  options: DealFormOptions;
  canSeeFinance: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Handoff "Ganho → Cliente + Projeto + Atendimento": uma chamada só a close_deal_won(). */
export function WonDialog({ deal, options, canSeeFinance, open, onOpenChange, onDone }: WonDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WonValues>({
    resolver: zodResolver(wonSchema),
    defaultValues: {
      dealId: deal.id!,
      projectName: "",
      projectModel: "transacional",
      contractValue: deal.estimated_value != null ? centsToInput(toCents(deal.estimated_value)) : "",
      tier: undefined as never,
      startDate: "",
      endDate: "",
      projectOwnerId: "",
      atendimentoId: "",
    },
  });
  const model = watch("projectModel");

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await closeDealWonAction(values);
      if (result.ok) {
        toast.success(result.message);
        setProjectId(result.projectId ?? null);
        onDone();
      } else {
        setError(result.error);
      }
    });
  });

  if (projectId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Negócio ganho.</DialogTitle>
          </DialogHeader>
          <Alert variant="success">O cliente foi criado, o projeto está vinculado ao negócio e o atendimento recebeu a pauta de onboarding.</Alert>
          <DialogFooter>
            <Button asChild>
              <Link href={`/projetos/${projectId}`}>Abrir projeto</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar como ganho."
      description="A empresa vira cliente, o projeto é criado já vinculado ao negócio e o atendimento assume o onboarding. A comissão continua com o SDR."
      error={error}
      pending={pending}
      submitLabel="Fechar negócio"
      onSubmit={onSubmit}
      wide
    >
      <FormField id="won-name" label="Nome do projeto" error={errors.projectName?.message}>
        <Input id="won-name" aria-invalid={!!errors.projectName} {...register("projectName")} />
      </FormField>
      <FormField id="won-model" label="Modelo comercial">
        <NativeSelect id="won-model" {...register("projectModel")}>
          {MODELS.map((item) => (
            <option key={item} value={item}>
              {MODEL_LABELS[item]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {model === "transacional" ? (
        <FormField id="won-due" label="Data de entrega" error={errors.endDate?.message}>
          <Input id="won-due" type="date" {...register("endDate")} />
        </FormField>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="won-start" label="Início do projeto" error={errors.startDate?.message}>
            <Input id="won-start" type="date" {...register("startDate")} />
          </FormField>
          <FormField id="won-end" label="Fim do projeto" hint="Vazio se está em andamento." error={errors.endDate?.message}>
            <Input id="won-end" type="date" {...register("endDate")} />
          </FormField>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="won-tier" label="Nível do cliente" error={errors.tier?.message}>
          <NativeSelect id="won-tier" defaultValue="" aria-invalid={!!errors.tier} {...register("tier")}>
            <option value="" disabled>
              Selecione o nível
            </option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {canSeeFinance ? (
          <FormField id="won-value" label="Valor do contrato (R$)" hint="Também é a base da comissão." error={errors.contractValue?.message}>
            <Input id="won-value" inputMode="decimal" placeholder="0,00" {...register("contractValue")} />
          </FormField>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="won-owner" label="Responsável pelo projeto" error={errors.projectOwnerId?.message}>
          <NativeSelect id="won-owner" defaultValue="" aria-invalid={!!errors.projectOwnerId} {...register("projectOwnerId")}>
            <option value="" disabled>
              Selecione
            </option>
            {options.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="won-atendimento" label="Atendimento responsável" hint="Recebe o onboarding." error={errors.atendimentoId?.message}>
          <NativeSelect id="won-atendimento" defaultValue="" aria-invalid={!!errors.atendimentoId} {...register("atendimentoId")}>
            <option value="" disabled>
              Selecione
            </option>
            {options.atendimento.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
    </FlowDialog>
  );
}
