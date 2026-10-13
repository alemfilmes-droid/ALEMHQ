"use client";

import { useState, useTransition } from "react";
import { CalendarCog, LogOut, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  EditCadenceDialog,
  EraseProspectingDialog,
  RemoveProspectingDialog,
  RestartCadenceDialog,
  type ManageKind,
} from "@/features/prospeccao/components/manage/manage-dialogs";
import { manageOptionsAction, type ManageOptions } from "@/features/prospeccao/manage-actions";

/**
 * "Gerenciar prospecção" (CEO/admin e Head comercial; quem chama já confere a permissão e o servidor de novo).
 * As opções são carregadas ao abrir o menu. "Apagar" fica separado, na cor de erro do HQ.
 */
export function ManageProspectingMenu({ dealId }: { dealId: string }) {
  const [options, setOptions] = useState<ManageOptions | null>(null);
  const [dialog, setDialog] = useState<ManageKind | null>(null);
  const [loading, startLoading] = useTransition();

  function load(open: boolean) {
    if (!open) return;
    startLoading(async () => {
      const result = await manageOptionsAction(dealId);
      if (!result) toast.error("Não foi possível carregar a prospecção deste lead.");
      setOptions(result);
    });
  }

  const close = () => {
    setDialog(null);
    setOptions(null);
  };

  return (
    <>
      <DropdownMenu onOpenChange={load}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="lg" className="sm:h-9" loading={loading}>
            <Settings2 aria-hidden />
            Gerenciar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {options?.inCadence ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => setDialog("editar")}>
              <CalendarCog aria-hidden />
              Editar cadência
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="min-h-11" disabled={!options || options.playbooks.length === 0} onSelect={() => setDialog("reiniciar")}>
            <RotateCcw aria-hidden />
            Reiniciar cadência
          </DropdownMenuItem>
          {options?.inCadence ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => setDialog("remover")}>
              <LogOut aria-hidden />
              Remover da prospecção
            </DropdownMenuItem>
          ) : null}
          {options?.hadCadence ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 text-[var(--status-danger)] focus:text-[var(--status-danger)] [&_svg]:text-[var(--status-danger)]"
                onSelect={() => setDialog("apagar")}
              >
                <Trash2 aria-hidden />
                Apagar prospecção
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {options && dialog === "editar" ? <EditCadenceDialog dealId={dealId} options={options} onClose={close} /> : null}
      {options && dialog === "reiniciar" ? <RestartCadenceDialog dealId={dealId} options={options} onClose={close} /> : null}
      {options && dialog === "remover" ? <RemoveProspectingDialog dealId={dealId} options={options} onClose={close} /> : null}
      {options && dialog === "apagar" ? <EraseProspectingDialog dealId={dealId} options={options} onClose={close} /> : null}
    </>
  );
}
