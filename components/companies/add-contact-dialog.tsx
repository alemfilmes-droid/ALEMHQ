"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createContactAction } from "@/app/(app)/clientes/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contactSchema, type ContactValues } from "@/lib/validations/company";

const EMPTY: ContactValues = { fullName: "", jobTitle: "", email: "", phone: "", isDecisionMaker: false };

export function AddContactDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: EMPTY });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset(EMPTY);
      setError(null);
    }
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createContactAction(companyId, values);
      if (result.ok) {
        toast.success(result.message);
        handleOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <UserPlus aria-hidden />
          Novo contato
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo contato.</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <FormField id="contact-name" label="Nome" error={errors.fullName?.message}>
            <Input id="contact-name" {...register("fullName")} aria-invalid={!!errors.fullName} />
          </FormField>
          <FormField id="contact-title" label="Cargo" error={errors.jobTitle?.message}>
            <Input id="contact-title" {...register("jobTitle")} />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="contact-email" label="E-mail" error={errors.email?.message}>
              <Input id="contact-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
            </FormField>
            <FormField id="contact-phone" label="Telefone" error={errors.phone?.message}>
              <Input id="contact-phone" type="tel" {...register("phone")} aria-invalid={!!errors.phone} />
            </FormField>
          </div>
          <div className="flex items-center gap-2">
            <Controller control={control} name="isDecisionMaker" render={({ field }) => <Checkbox id="contact-decision" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />} />
            <Label htmlFor="contact-decision" className="cursor-pointer font-normal">
              É decisor(a)
            </Label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
