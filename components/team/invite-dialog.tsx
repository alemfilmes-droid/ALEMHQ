"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteMemberAction } from "@/app/(app)/equipe/actions";
import { FunctionPicker } from "@/components/team/function-picker";
import { RoleSelect } from "@/components/team/role-select";
import { SquadPicker } from "@/components/team/squad-picker";
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
import { inviteMemberSchema, type InviteMemberValues } from "@/lib/validations/team";

const EMPTY = { email: "", functions: [], squads: [] };

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberValues>({ resolver: zodResolver(inviteMemberSchema), defaultValues: EMPTY });

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
      const result = await inviteMemberAction(values);
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
        <Button>
          <UserPlus aria-hidden />
          Convidar pessoa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar pessoa.</DialogTitle>
          <DialogDescription>A pessoa recebe um e-mail para definir nome e senha. O convite vale por 7 dias.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id="invite-email" label="E-mail" error={errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "invite-email-message" : undefined}
              {...register("email")}
            />
          </FormField>

          <FormField id="invite-role" label="Papel de acesso" error={errors.accessRole?.message}>
            <Controller
              control={control}
              name="accessRole"
              render={({ field }) => (
                <RoleSelect id="invite-role" value={field.value} onChange={field.onChange} invalid={!!errors.accessRole} />
              )}
            />
          </FormField>

          <Controller
            control={control}
            name="functions"
            render={({ field }) => <FunctionPicker idPrefix="invite-fn" value={field.value ?? []} onChange={field.onChange} />}
          />

          <Controller
            control={control}
            name="squads"
            render={({ field }) => <SquadPicker idPrefix="invite-sq" value={field.value ?? []} onChange={field.onChange} />}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
