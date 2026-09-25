import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvalidLink } from "@/components/auth/invalid-link";
import { PasswordForm } from "@/components/auth/password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell title="Nova senha." description={user ? "Defina uma nova senha para sua conta." : undefined}>
      {user ? <PasswordForm mode="reset" /> : <InvalidLink />}
    </AuthShell>
  );
}
