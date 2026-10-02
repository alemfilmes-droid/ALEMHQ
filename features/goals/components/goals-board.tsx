"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalFormDialog } from "@/features/goals/components/goal-form-dialog";

/** Botão "Nova meta" da diretoria (o formulário é client; a lista é renderizada no servidor). */
export function NewGoalButton({ owners }: { owners: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nova meta
      </Button>
      {open ? <GoalFormDialog owners={owners} onOpenChange={setOpen} /> : null}
    </>
  );
}

export function GoalsEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
      <Target className="mb-3 size-6 text-muted-foreground" aria-hidden />
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
