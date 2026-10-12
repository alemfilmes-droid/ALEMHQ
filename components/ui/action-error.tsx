"use client";

import { RotateCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Erro de uma ação, com "Recarregar" quando a tela ficou antiga depois de uma publicação. */
export function ActionError({ message, reload }: { message: string | null; reload?: boolean }) {
  if (!message) return null;
  return (
    <Alert variant="error">
      <span>{message}</span>
      {reload ? (
        <Button type="button" size="lg" variant="secondary" className="mt-2 flex" onClick={() => window.location.reload()}>
          <RotateCw aria-hidden />
          Recarregar o HQ
        </Button>
      ) : null}
    </Alert>
  );
}
