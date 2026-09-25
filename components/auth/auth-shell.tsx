import Image from "next/image";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description?: string;
  /** Página de login: hero com o logo completo ao lado do formulário. */
  hero?: boolean;
  children: ReactNode;
}

export function AuthShell({ title, description, hero = false, children }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {hero ? (
        <section
          aria-label="Além Filmes"
          className="relative hidden flex-col justify-between border-r border-border bg-surface p-16 lg:flex"
        >
          <Image
            src="/brand/alem-filmes_texto-branco.png"
            alt="Além Filmes"
            width={7337}
            height={1432}
            priority
            sizes="448px"
            className="h-auto w-full max-w-md"
          />
          <div className="max-w-md space-y-3">
            <p className="font-display text-4xl font-black leading-tight tracking-tight">Além HQ.</p>
            <p className="text-base text-muted-foreground">
              O sistema interno da Além Filmes. Projetos, agenda e equipe em um só lugar.
            </p>
          </div>
        </section>
      ) : null}

      <section className={`flex flex-col items-center justify-center px-4 py-16 sm:px-8 ${hero ? "" : "lg:col-span-2"}`}>
        <div className="w-full max-w-sm">
          <div className={hero ? "mb-10 lg:hidden" : "mb-10"}>
            <Image
              src="/brand/alem_texto-branco.png"
              alt="Além"
              width={4100}
              height={1432}
              priority
              sizes="128px"
              className="h-auto w-32"
            />
          </div>
          <h1 className="page-title">{title}</h1>
          {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
