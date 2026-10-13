"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientErrorAction } from "@/lib/observability/report-error-action";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  description: string;
}

/**
 * Tela de erro das páginas: relata o erro real para o log da Vercel (com a rota e o papel de quem estava logado)
 * e mostra o código — com ele dá para achar o registro exato no log.
 */
export function ErrorScreen({ error, reset, title, description }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
    void reportClientErrorAction({
      path: `${window.location.pathname}${window.location.search}`,
      message: error.message,
      digest: error.digest ?? null,
      name: error.name,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
      <AlertCircle className="mb-4 size-8" aria-hidden />
      <p className="font-display text-2xl font-black tracking-tight">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {error.digest ? <p className="mt-3 text-xs text-subtle">Código do erro: {error.digest}</p> : null}
      <Button variant="secondary" className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
