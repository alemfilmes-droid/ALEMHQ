import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">Erro 404</p>
      <h1 className="page-title mt-3">Página não encontrada.</h1>
      <p className="mt-3 text-sm text-muted-foreground">O endereço não existe ou foi movido.</p>
      <Link href="/inicio" className={buttonVariants({ className: "mt-8" })}>
        Voltar ao início
      </Link>
    </main>
  );
}
