"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginValues } from "@/lib/validations/auth";

const NOTICES: Record<string, string> = {
  "conta-desativada": "Sua conta está desativada. Fale com a administração.",
  "link-invalido": "Link inválido ou expirado. Peça um novo à administração.",
};

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(values, next);
      if (result && !result.ok) setError(result.error);
    });
  });

  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {noticeText ? <Alert variant="info">{noticeText}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <FormField id="email" label="E-mail" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="nome@alemfilmes.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-message" : undefined}
          {...register("email")}
        />
      </FormField>

      <FormField id="password" label="Senha" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-message" : undefined}
          {...register("password")}
        />
      </FormField>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="remember"
            render={({ field }) => (
              <Checkbox
                id="remember"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="remember" className="font-normal text-muted-foreground">
            Lembrar deste dispositivo
          </Label>
        </div>
        <Link href="/esqueci-senha" className="text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">
          Esqueci a senha
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Entrar
      </Button>
    </form>
  );
}
