"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

/**
 * Motivo da alteração. Fica sempre no fim do formulário; vira obrigatório (e bloqueia o salvar) assim
 * que o valor ou a data de pagamento mudam — o banco confere de novo.
 */
export function ChangeReasonField({ id, required, error, registration }: { id: string; required: boolean; error?: string; registration: UseFormRegisterReturn }) {
  return (
    <FormField
      id={id}
      label={required ? "Motivo da alteração (obrigatório)" : "Motivo da alteração (opcional)"}
      hint={required ? "O valor ou a data de pagamento mudou: explique o porquê. Fica no histórico." : "Fica no histórico de alterações."}
      error={error}
    >
      <Textarea id={id} rows={2} aria-invalid={!!error} aria-required={required} {...registration} />
    </FormField>
  );
}
