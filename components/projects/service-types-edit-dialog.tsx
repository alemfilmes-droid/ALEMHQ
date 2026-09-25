"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateProjectAction } from "@/app/(app)/projetos/actions";
import { ServiceTypePicker } from "@/components/projects/service-type-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ServiceType } from "@/types";

export function ServiceTypesEditDialog({ projectId, serviceTypes }: { projectId: string; serviceTypes: ServiceType[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(serviceTypes);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setValue(serviceTypes);
  }

  function save() {
    startTransition(async () => {
      const result = await updateProjectAction(projectId, { serviceTypes: value });
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
        <Button variant="ghost" size="icon" aria-label="Editar tipos de serviço" className="size-6">
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tipo de projeto.</DialogTitle>
        </DialogHeader>
        <ServiceTypePicker idPrefix="proj-svc" value={value} onChange={setValue} />
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
