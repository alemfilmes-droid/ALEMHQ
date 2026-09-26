"use client";

import { useTransition } from "react";
import { Pencil, Phone, Power } from "lucide-react";
import { toast } from "sonner";
import { FreelancerDialog } from "@/components/team/freelancer-dialog";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setFreelancerActiveAction } from "@/features/team/freelancer-actions";
import { FUNCTION_LABELS } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import type { Freelancer } from "@/types";

function FreelancerRow({ freelancer, canManage }: { freelancer: Freelancer; canManage: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setFreelancerActiveAction(freelancer.id, !freelancer.is_active);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 p-4", !freelancer.is_active && "opacity-60")}>
      <UserAvatar name={freelancer.full_name} plain className="size-10" />
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex items-center gap-2 truncate text-sm font-bold">
          {freelancer.full_name}
          <Badge variant="outline">Freelancer</Badge>
          {!freelancer.is_active ? <Badge variant="muted">Desativado</Badge> : null}
        </p>
        <p className="truncate text-[13px] text-muted-foreground">
          {[freelancer.city, freelancer.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
        </p>
      </div>
      {freelancer.phone ? (
        <a href={`tel:${freelancer.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          <Phone className="size-3.5" aria-hidden />
          {freelancer.phone}
        </a>
      ) : null}
      <ul className="flex w-full flex-wrap items-center gap-1.5 md:w-64" aria-label="Atuação">
        {freelancer.functions.length > 0 ? (
          freelancer.functions.map((fn) => (
            <li key={fn}>
              <Badge variant="muted">{FUNCTION_LABELS[fn]}</Badge>
            </li>
          ))
        ) : (
          <li className="text-[13px] text-subtle">—</li>
        )}
      </ul>
      {canManage ? (
        <div className="ml-auto flex items-center gap-1">
          <FreelancerDialog
            freelancer={freelancer}
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Editar ${freelancer.full_name}`}>
                <Pencil aria-hidden />
                Editar
              </Button>
            }
          />
          <Button variant="ghost" size="sm" onClick={toggleActive} loading={pending}>
            <Power aria-hidden />
            {freelancer.is_active ? "Desativar" : "Reativar"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Lista de freelancers da seção Equipe. */
export function FreelancerList({ freelancers, canManage }: { freelancers: Freelancer[]; canManage: boolean }) {
  if (freelancers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">
        Nenhum freelancer cadastrado. {canManage ? "Use “Cadastrar freelancer” para adicionar." : ""}
      </p>
    );
  }
  return (
    <ul className="card-surface card-static divide-y divide-border rounded-lg">
      {freelancers.map((freelancer) => (
        <FreelancerRow key={freelancer.id} freelancer={freelancer} canManage={canManage} />
      ))}
    </ul>
  );
}
