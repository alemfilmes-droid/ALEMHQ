"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { UrlSearchInput } from "@/components/filters/filter-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIENT_HEALTHS } from "@/lib/validations/health";
import { CLIENT_HEALTH_LABELS } from "@/lib/status";

const ALL = "all";
const KEYS = ["saude", "cidade", "busca"] as const;

/** Busca por nome, saúde e cidade — tudo na URL. A aba (Clientes/Prospects) é preservada ao limpar. */
export function CompanyFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const health = searchParams.get("saude") ?? ALL;
  const [city, setCity] = useState(searchParams.get("cidade") ?? "");

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || value === "") params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const hasFilters = KEYS.some((key) => searchParams.has(key));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <UrlSearchInput label="Buscar empresa" />
      <div className="sm:w-48">
        <Select value={health} onValueChange={(value) => update("saude", value)}>
          <SelectTrigger aria-label="Filtrar por saúde">
            <SelectValue>{health === ALL ? "Todas as saúdes" : (CLIENT_HEALTH_LABELS[health as keyof typeof CLIENT_HEALTH_LABELS] ?? "Todas as saúdes")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as saúdes</SelectItem>
            {CLIENT_HEALTHS.map((item) => (
              <SelectItem key={item} value={item}>
                {CLIENT_HEALTH_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <form
        className="relative sm:w-52"
        onSubmit={(event) => {
          event.preventDefault();
          update("cidade", city.trim());
        }}
      >
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input aria-label="Buscar por cidade" placeholder="Cidade" className="pl-9" value={city} onChange={(event) => setCity(event.target.value)} />
      </form>
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setCity("");
            const params = new URLSearchParams(searchParams.toString());
            for (const key of KEYS) params.delete(key);
            router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
          }}
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
