"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const response = await forgotPasswordAction(values);
      setResult({ ok: response.ok, text: response.ok ? (response.message ?? "") : response.error });
    });
  });

  return (
    // method="post": se o JavaScript não carregar, o navegador nunca manda e-mail e senha na URL.
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
      {result ? <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert> : null}

      <FormField id="email" label="E-mail" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-message" : undefined}
          {...register("email")}
        />
      </FormField>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Enviar link
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para o login
      </Link>
    </form>
  );
}
