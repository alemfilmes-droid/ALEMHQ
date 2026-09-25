"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
      <AlertCircle className="mb-4 size-8" aria-hidden />
      <p className="font-display text-2xl font-black tracking-tight">Algo deu errado.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Não foi possível carregar esta página. Tente novamente.</p>
      <Button variant="secondary" className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
