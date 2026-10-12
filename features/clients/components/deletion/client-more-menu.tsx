"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteClientDialog } from "@/features/clients/components/deletion/delete-client-dialog";

/** Menu ⋯ da página do cliente (só a conta master): "Excluir cliente". */
export function ClientMoreMenu({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="size-11 sm:size-8" aria-label={`Mais ações para ${companyName}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onSelect={() => setDeleting(true)}>
            <Trash2 aria-hidden />
            Excluir cliente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleting ? <DeleteClientDialog companyId={companyId} companyName={companyName} onClose={() => setDeleting(false)} /> : null}
    </>
  );
}
