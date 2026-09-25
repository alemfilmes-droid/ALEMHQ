"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error("[/projetos/[id]]", error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
      <AlertCircle className="mb-4 size-8" aria-hidden />
      <p className="font-display text-2xl font-black tracking-tight">Não foi possível carregar o projeto.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Tivemos um problema ao abrir esta página. Tente novamente — se persistir, avise a equipe de tecnologia.
      </p>
      <Button variant="secondary" className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
