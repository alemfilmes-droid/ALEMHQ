"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { FunctionPicker } from "@/components/team/function-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveFreelancerAction } from "@/features/team/freelancer-actions";
import { freelancerSchema, type FreelancerValues } from "@/lib/validations/freelancer";
import type { Freelancer } from "@/types";

function toValues(freelancer?: Freelancer): FreelancerValues {
  return {
    fullName: freelancer?.full_name ?? "",
    phone: freelancer?.phone ?? "",
    email: freelancer?.email ?? "",
    functions: freelancer?.functions ?? [],
    city: freelancer?.city ?? "",
    notes: freelancer?.notes ?? "",
  };
}

/** Cadastro manual de freelancer — sem convite e sem acesso ao sistema. */
export function FreelancerDialog({ freelancer, trigger }: { freelancer?: Freelancer; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FreelancerValues>({ resolver: zodResolver(freelancerSchema), defaultValues: toValues(freelancer) });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(toValues(freelancer));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await saveFreelancerAction(values, freelancer?.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Plus aria-hidden />
            Cadastrar freelancer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{freelancer ? "Editar freelancer." : "Novo freelancer."}</DialogTitle>
          <DialogDescription>
            Freelancer não acessa o sistema. Nas pautas, ele só sinaliza com quem está a execução — o responsável da equipe continua cobrando a entrega.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <FormField id="fl-name" label="Nome" error={errors.fullName?.message}>
            <Input id="fl-name" aria-invalid={!!errors.fullName} {...register("fullName")} />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="fl-phone" label="Telefone / WhatsApp" hint="Opcional." error={errors.phone?.message}>
              <Input id="fl-phone" inputMode="tel" {...register("phone")} />
            </FormField>
            <FormField id="fl-email" label="E-mail" hint="Opcional." error={errors.email?.message}>
              <Input id="fl-email" type="email" {...register("email")} />
            </FormField>
          </div>
          <FormField id="fl-city" label="Cidade" hint="Opcional." error={errors.city?.message}>
            <Input id="fl-city" {...register("city")} />
          </FormField>
          <Controller
            control={control}
            name="functions"
            render={({ field }) => <FunctionPicker idPrefix="fl-fn" value={field.value} onChange={field.onChange} />}
          />
          <FormField id="fl-notes" label="Observações" hint="Opcional. Ex.: equipamento próprio, valor combinado, disponibilidade." error={errors.notes?.message}>
            <Textarea id="fl-notes" {...register("notes")} />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {freelancer ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
