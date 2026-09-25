"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { logContactAction } from "@/features/crm/actions";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { InteractionFields, NextActionFields } from "@/features/crm/components/flow/fields";
import { contactSchema, type ContactValues } from "@/features/crm/schemas";
import type { DealWithDetails } from "@/types";

interface RegisterContactDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** "+ Registrar contato": mais uma tentativa (canal + abordagem + conteúdo), sem mudar de etapa. */
export function RegisterContactDialog({ deal, open, onOpenChange, onDone }: RegisterContactDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { dealId: deal.id!, channel: undefined as never, approach: "", body: "", nextAction: "", nextActionDate: "", nextActionTime: "09:00" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await logContactAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar contato."
      description={`${deal.company_name} · ${deal.title}. Mais uma tentativa — a etapa continua a mesma.`}
      error={error}
      pending={pending}
      submitLabel="Registrar contato"
      onSubmit={onSubmit}
      wide
    >
      <InteractionFields register={register} errors={errors} idPrefix="contact" />
      <NextActionFields register={register} errors={errors} idPrefix="contact" optional />
      <p className="text-[13px] text-muted-foreground">
        Para atualizar a próxima ação, preencha texto e data. Se deixar em branco, a ação atual ({deal.next_action ?? "—"}) continua.
      </p>
    </FlowDialog>
  );
}
