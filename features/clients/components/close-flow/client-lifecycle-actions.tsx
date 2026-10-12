"use client";

import { useState } from "react";
import { Ban, PauseCircle, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCloseFlow } from "@/features/clients/components/close-flow/client-close-flow";
import { PauseClientDialog, ReactivateClientDialog } from "@/features/clients/components/close-flow/pause-reactivate-dialogs";
import { ReopenProspectionDialog } from "@/features/clients/components/close-flow/reopen-prospection-dialog";
import type { InactiveStatus } from "@/lib/clients/lifecycle";

type Open = "close" | "pause" | "reactivate" | "prospect" | null;

/** Botões do ciclo de vida na página do cliente: ativo → Encerrar / Pausar; inativo → Reativar / Reabrir prospecção. */
export function ClientLifecycleActions({ companyId, companyName, inactive }: { companyId: string; companyName: string; inactive: InactiveStatus | null }) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  return (
    <>
      {inactive ? (
        <>
          <Button type="button" variant="secondary" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setOpen("prospect")}>
            <Send aria-hidden />
            Reabrir prospecção
          </Button>
          <Button type="button" variant="secondary" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setOpen("reactivate")}>
            <RotateCcw aria-hidden />
            Reativar cliente
          </Button>
        </>
      ) : (
        <>
          <Button type="button" variant="secondary" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setOpen("pause")}>
            <PauseCircle aria-hidden />
            Pausar cliente
          </Button>
          <Button type="button" variant="secondary" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setOpen("close")}>
            <Ban aria-hidden />
            Encerrar cliente
          </Button>
        </>
      )}
      {open === "close" ? <ClientCloseFlow companyId={companyId} companyName={companyName} onClose={close} /> : null}
      {open === "pause" ? <PauseClientDialog companyId={companyId} companyName={companyName} onClose={close} /> : null}
      {open === "reactivate" ? <ReactivateClientDialog companyId={companyId} companyName={companyName} paused={inactive === "pausado"} onClose={close} /> : null}
      {open === "prospect" ? <ReopenProspectionDialog companyId={companyId} companyName={companyName} onClose={close} /> : null}
    </>
  );
}
