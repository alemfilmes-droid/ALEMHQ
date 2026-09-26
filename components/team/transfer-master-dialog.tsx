"use client";

import { useState, useTransition } from "react";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { transferMasterAction } from "@/app/(app)/equipe/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileWithSquads } from "@/types";

interface TransferMasterDialogProps {
  candidates: ProfileWithSquads[];
}

/** Ação irreversível na hora (a pessoa pode devolver depois, mas só se o novo master transferir de volta). */
export function TransferMasterDialog({ candidates }: TransferMasterDialogProps) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Só quem já está no nível Diretoria pode receber o master (a função transfer_master() confere de novo).
  const eligible = candidates.filter((candidate) => candidate.org_level === "diretoria");
  const target = eligible.find((candidate) => candidate.id === targetId);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTargetId("");
      setConfirming(false);
      setError(null);
    }
  }

  function confirmTransfer() {
    if (!targetId) return;
    startTransition(async () => {
      const result = await transferMasterAction({ newMasterId: targetId });
      if (result.ok) {
        toast.success(result.message);
        handleOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Crown aria-hidden />
          Transferir master
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir master.</DialogTitle>
          <DialogDescription>
            Só existe um master por vez. Ao transferir, você passa a ser diretoria e a pessoa escolhida assume o master
            imediatamente — inclusive a permissão de promover ou demitir diretores.
          </DialogDescription>
        </DialogHeader>

        {error ? <Alert variant="error">{error}</Alert> : null}

        {!confirming ? (
          <>
            {eligible.length === 0 ? (
              <Alert variant="info">
                Ninguém está no nível Diretoria ainda. Mude o nível da pessoa em Equipe (Editar → Nível hierárquico) e volte aqui.
              </Alert>
            ) : null}
            <FormField
              id="transfer-master-target"
              label="Nova pessoa master"
              hint="Só aparecem pessoas ativas no nível Diretoria."
            >
              <Select value={targetId} onValueChange={setTargetId} disabled={eligible.length === 0}>
                <SelectTrigger id="transfer-master-target">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="button" disabled={!targetId} onClick={() => setConfirming(true)}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Confirma transferir o master para <span className="font-bold text-foreground">{target?.full_name}</span>? Você não
              poderá desfazer sozinho — só {target?.full_name} poderá transferir de volta.
            </p>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                Voltar
              </Button>
              <Button type="button" loading={pending} onClick={confirmTransfer}>
                Transferir master
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
