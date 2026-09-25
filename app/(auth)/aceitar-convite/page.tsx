import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvalidLink } from "@/components/auth/invalid-link";
import { PasswordForm } from "@/components/auth/password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aceitar convite" };

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell
      title="Seu acesso ao Além HQ."
      description={user ? "Informe seu nome e crie uma senha para concluir o acesso." : undefined}
    >
      {user ? <PasswordForm mode="accept-invite" /> : <InvalidLink />}
    </AuthShell>
  );
}
