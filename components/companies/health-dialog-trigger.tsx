"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { HealthDot } from "@/components/companies/company-meta";
import { HealthQuickDialog } from "@/components/companies/health-quick-dialog";
import type { Company } from "@/types";

interface HealthDialogTriggerProps {
  company: Pick<Company, "id" | "name" | "health" | "health_note">;
  canManage: boolean;
}

export function HealthDialogTrigger({ company, canManage }: HealthDialogTriggerProps) {
  const [open, setOpen] = useState(false);

  if (!canManage) return <HealthDot health={company.health} showLabel />;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex items-center gap-1.5">
        <HealthDot health={company.health} showLabel />
        <Pencil className="size-3 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </button>
      {open ? <HealthQuickDialog company={company} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
