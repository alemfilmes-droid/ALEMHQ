"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SquadCountStrip } from "@/features/pautas/components/squad-count-strip";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types";

/**
 * Tira de squads de /pautas, na URL (?squad=…) junto com os demais filtros do popover: clicar num squad
 * filtra só por ele; clicar no mesmo de novo limpa. As contagens consideram os outros filtros, não o squad.
 */
export function PautasSquadFilter({ counts, selected }: { counts: { squad: Squad; count: number }[]; selected: readonly Squad[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = selected.length === 1 ? (selected[0] ?? null) : null;

  function toggle(squad: Squad) {
    const params = new URLSearchParams(searchParams.toString());
    if (active === squad) params.delete("squad");
    else params.set("squad", squad);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")}>
      <SquadCountStrip counts={counts} activeSquad={active} onToggle={toggle} />
    </div>
  );
}
