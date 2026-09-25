import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<{ next?: string; erro?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, erro } = await searchParams;
  return (
    <AuthShell hero title="Entrar." description="Acesso restrito à equipe da Além Filmes.">
      <LoginForm next={next} notice={erro} />
    </AuthShell>
  );
}
