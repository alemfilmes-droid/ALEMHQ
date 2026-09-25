"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function shiftMonth(yearMonth: string, delta: number) {
  const [year = 0, month = 1] = yearMonth.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function monthLabel(yearMonth: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Fortaleza" }).format(
    new Date(`${yearMonth}-01T12:00:00Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MonthSelector({ yearMonth }: { yearMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" size="icon" aria-label="Mês anterior" onClick={() => go(shiftMonth(yearMonth, -1))}>
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-36 text-center text-sm font-bold">{monthLabel(yearMonth)}</span>
      <Button type="button" variant="secondary" size="icon" aria-label="Próximo mês" onClick={() => go(shiftMonth(yearMonth, 1))}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
