import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Esqueci a senha." description="Informe seu e-mail. Enviaremos um link para criar uma nova senha.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
