import Image from "next/image";
import Link from "next/link";

/** Páginas públicas de texto (política de privacidade e termos) — exigidas pelo OAuth do Google. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 sm:px-8">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Link href="/login" aria-label="Além HQ">
          <Image src="/brand/alem-filmes_texto-branco.png" alt="Além Filmes" width={4400} height={673} priority className="h-auto w-[168px]" />
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:text-foreground">
            Termos
          </Link>
        </nav>
      </header>
      <article className="space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:pt-4 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </article>
    </main>
  );
}
