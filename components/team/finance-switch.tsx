"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setFinanceAccessAction } from "@/app/(app)/equipe/actions";
import { Switch } from "@/components/ui/switch";
import { hasCapability } from "@/lib/auth/permissions";
import type { ProfileWithSquads } from "@/types";

/** Controla só a exceção manual (has_finance_access). Diretoria/financeiro já têm acesso pelo squad. */
export function FinanceSwitch({ member, isSelf }: { member: ProfileWithSquads; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const viaSquad = hasCapability(member, "finance") && !member.has_finance_access;

  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
      <Switch
        checked={member.has_finance_access}
        disabled={isSelf || pending || !member.is_active || viaSquad}
        aria-label={`Acesso ao financeiro para ${member.full_name}`}
        title={viaSquad ? "Já tem acesso pelo squad (diretoria ou financeiro)." : undefined}
        onCheckedChange={(granted) =>
          startTransition(async () => {
            const result = await setFinanceAccessAction({ id: member.id, granted });
            if (result.ok) toast.success(result.message);
            else toast.error(result.error);
          })
        }
      />
      <span className="hidden lg:inline">{viaSquad ? "Via squad" : "Financeiro"}</span>
    </label>
  );
}
