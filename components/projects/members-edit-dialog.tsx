"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateProjectMembersAction } from "@/app/(app)/projetos/actions";
import { MemberPicker } from "@/components/projects/member-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface MembersEditDialogProps {
  projectId: string;
  memberIds: string[];
  members: { id: string; full_name: string; avatar_url: string | null }[];
}

export function MembersEditDialog({ projectId, memberIds, members }: MembersEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(memberIds);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setValue(memberIds);
  }

  function save() {
    startTransition(async () => {
      const result = await updateProjectMembersAction({ id: projectId, memberIds: value });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Editar responsáveis" className="size-6">
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsáveis pelo projeto.</DialogTitle>
        </DialogHeader>
        <MemberPicker idPrefix="proj-member" value={value} onChange={setValue} members={members} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" loading={pending} onClick={save}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
