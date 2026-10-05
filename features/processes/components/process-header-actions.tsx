"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProcessArchivedAction } from "@/features/processes/actions";
import { ProcessFormDialog } from "@/features/processes/components/process-form-dialog";
import type { ProcessDetail } from "@/features/processes/types";
import type { Squad } from "@/types";

/** Editar dados do fluxograma e arquivar/reativar (só liderança do squad). */
export function ProcessHeaderActions({ process, squads }: { process: ProcessDetail; squads: Squad[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    if (!process.archived && !window.confirm("Arquivar este fluxograma? Ele some para a equipe; dá para reativar depois.")) return;
    startTransition(async () => {
      const result = await setProcessArchivedAction(process.id, !process.archived);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        Editar
      </Button>
      <Button size="sm" variant="ghost" onClick={toggleArchive} loading={pending}>
        {process.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {process.archived ? "Reativar" : "Arquivar"}
      </Button>
      {editing ? <ProcessFormDialog process={process} squads={squads} onOpenChange={setEditing} /> : null}
    </div>
  );
}
