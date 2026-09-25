"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { setMemberActiveAction } from "@/app/(app)/equipe/actions";
import { EditMemberDialog } from "@/components/team/edit-member-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { canManageOrgLevel } from "@/lib/auth/permissions";
import type { ProfileWithSquads } from "@/types";

interface MemberActionsProps {
  member: ProfileWithSquads;
  viewer: ProfileWithSquads;
  viewerIsAdmin: boolean;
  isSelf: boolean;
}

export function MemberActions({ member, viewer, viewerIsAdmin, isSelf }: MemberActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canEditHierarchy = !isSelf && canManageOrgLevel(viewer.id, viewer, member);

  if (!viewerIsAdmin && !canEditHierarchy) return null;

  function setActive(active: boolean) {
    startTransition(async () => {
      const result = await setMemberActiveAction({ id: member.id, active });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setConfirmOpen(false);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações para ${member.full_name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            {viewerIsAdmin ? "Editar papel e funções" : "Editar nível hierárquico"}
          </DropdownMenuItem>
          {!viewerIsAdmin || isSelf ? null : member.is_active ? (
            <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
              <UserX aria-hidden />
              Desativar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setActive(true)}>
              <UserCheck aria-hidden />
              Reativar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? (
        <EditMemberDialog member={member} viewer={viewer} viewerIsAdmin={viewerIsAdmin} isSelf={isSelf} open={editOpen} onOpenChange={setEditOpen} />
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar acesso.</DialogTitle>
            <DialogDescription>
              {member.full_name} perde o acesso ao Além HQ imediatamente. Os dados são mantidos e você pode reativar depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button loading={pending} onClick={() => setActive(false)}>
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
