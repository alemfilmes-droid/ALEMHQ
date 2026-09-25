"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/(app)/perfil/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { profileSchema, type ProfileValues } from "@/lib/validations/profile";

export function ProfileForm({ defaultValues }: { defaultValues: ProfileValues }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result.ok) {
        toast.success(result.message);
        reset(values);
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormField id="fullName" label="Nome completo" error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? "fullName-message" : undefined}
          {...register("fullName")}
        />
      </FormField>
      <FormField id="phone" label="Telefone" error={errors.phone?.message} hint="Opcional.">
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(84) 90000-0000"
          aria-invalid={!!errors.phone}
          aria-describedby="phone-message"
          {...register("phone")}
        />
      </FormField>
      <Button type="submit" loading={pending} disabled={!isDirty}>
        Salvar alterações
      </Button>
    </form>
  );
}
