"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reopenClientAction } from "@/features/clients/closure-actions";
import { Button } from "@/components/ui/button";

/** "Reativar cliente": volta a 'client' e registra no histórico. Nada do financeiro cancelado volta. */
export function ReopenClientButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() => {
        if (!window.confirm("Reativar este cliente? Projetos encerrados e lançamentos cancelados continuam como estão.")) return;
        startTransition(async () => {
          const result = await reopenClientAction(companyId);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      <RotateCcw aria-hidden />
      Reativar cliente
    </Button>
  );
}
