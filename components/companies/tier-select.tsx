"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateCompanyTierAction } from "@/app/(app)/clientes/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIERS, TIER_LABELS } from "@/lib/domain";
import type { ClientTier } from "@/types";

/** Só existe quando o cliente já é 'client' — o banco também bloqueia para prospects. */
export function TierSelect({ companyId, tier }: { companyId: string; tier: ClientTier | null }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={tier ?? undefined}
      disabled={pending}
      onValueChange={(next) =>
        startTransition(async () => {
          const result = await updateCompanyTierAction({ id: companyId, tier: next as ClientTier });
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <SelectTrigger aria-label="Nível do cliente" className="w-40">
        <SelectValue placeholder="Definir nível" />
      </SelectTrigger>
      <SelectContent>
        {TIERS.map((item) => (
          <SelectItem key={item} value={item}>
            {TIER_LABELS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
