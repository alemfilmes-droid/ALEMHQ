import Image from "next/image";
import type { ReactNode } from "react";
import { CinematicPanel } from "@/components/auth/cinematic-panel";

interface AuthShellProps {
  title: string;
  description?: string;
  /** Página de login: painel visual animado ao lado do formulário. */
  hero?: boolean;
  children: ReactNode;
}

/**
 * Casca das telas de acesso. Logotipo completo (alem-filmes_texto-branco.png) no canto superior
 * esquerdo; formulário de um lado e, no login, o painel visual do outro, separados por um fio com
 * degradê vermelho discreto.
 */
export function AuthShell({ title, description, hero = false, children }: AuthShellProps) {
  return (
    <main className={`relative grid min-h-dvh ${hero ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
      <section className="relative flex flex-col px-5 pb-12 pt-8 sm:px-10 lg:px-14">
        <header className="shrink-0">
          <Image
            src="/brand/alem-filmes_texto-branco.png"
            alt="Além Filmes"
            width={4400}
            height={673}
            priority
            sizes="(min-width: 640px) 208px, 168px"
            className="h-auto w-[168px] sm:w-[208px]"
          />
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="page-title">{title}</h1>
            {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <p className="shrink-0 text-xs text-subtle">Além HQ · sistema interno da Além Filmes</p>
      </section>

      {hero ? (
        <section aria-label="Além Filmes" className="relative hidden overflow-hidden lg:block">
          {/* Divisória: fio de 1px com degradê vermelho que some nas pontas. */}
          <span aria-hidden className="accent-rule absolute inset-y-0 left-0 z-10 w-px" />
          <CinematicPanel />
          <div className="relative z-10 flex h-full flex-col justify-end p-14">
            <div className="max-w-md space-y-3">
              <p className="eyebrow text-muted-foreground">Visão além do óbvio.</p>
              <p className="font-display text-5xl font-black leading-[1.02] tracking-tight">Além HQ.</p>
              <p className="text-base text-muted-foreground">Projetos, pautas, agenda, comercial e financeiro da produtora em um só lugar.</p>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
