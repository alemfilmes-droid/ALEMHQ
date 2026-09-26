"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { acceptInviteAction, resetPasswordAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  acceptInviteSchema,
  resetPasswordFormSchema,
  type AcceptInviteValues,
} from "@/lib/validations/auth";

type PasswordFormProps = { mode: "reset" | "accept-invite" };

const PASSWORD_HINT = "Mínimo de 8 caracteres, com letras e números.";

/** Formulário compartilhado por /redefinir-senha e /aceitar-convite (esta última também pede o nome). */
export function PasswordForm({ mode }: PasswordFormProps) {
  const isInvite = mode === "accept-invite";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(isInvite ? acceptInviteSchema : resetPasswordFormSchema),
    defaultValues: { fullName: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = isInvite ? await acceptInviteAction(values) : await resetPasswordAction(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    // method="post": se o JavaScript não carregar, o navegador nunca manda e-mail e senha na URL.
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {isInvite ? (
        <FormField id="fullName" label="Nome completo" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "fullName-message" : undefined}
            {...register("fullName")}
          />
        </FormField>
      ) : null}

      <FormField id="password" label="Nova senha" error={errors.password?.message} hint={PASSWORD_HINT}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-message"
          {...register("password")}
        />
      </FormField>

      <FormField id="confirmPassword" label="Confirmar senha" error={errors.confirmPassword?.message}>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirmPassword-message" : undefined}
          {...register("confirmPassword")}
        />
      </FormField>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {isInvite ? "Entrar no Além HQ" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
