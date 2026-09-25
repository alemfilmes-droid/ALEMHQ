"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIERS, TIER_LABELS } from "@/lib/domain";
import { CLIENT_HEALTHS } from "@/lib/validations/health";
import { CLIENT_HEALTH_LABELS } from "@/lib/status";

const ALL = "all";

export function CompanyFilters({ showTier }: { showTier: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const health = searchParams.get("saude") ?? ALL;
  const tier = searchParams.get("nivel") ?? ALL;
  const [city, setCity] = useState(searchParams.get("cidade") ?? "");

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || value === "") params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const hasFilters = health !== ALL || tier !== ALL || Boolean(searchParams.get("cidade"));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="sm:w-48">
        <Select value={health} onValueChange={(value) => update("saude", value)}>
          <SelectTrigger aria-label="Filtrar por saúde">
            <SelectValue />
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
      {showTier ? (
        <div className="sm:w-48">
          <Select value={tier} onValueChange={(value) => update("nivel", value)}>
            <SelectTrigger aria-label="Filtrar por nível">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os níveis</SelectItem>
              {TIERS.map((item) => (
                <SelectItem key={item} value={item}>
                  {TIER_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <form
        className="relative sm:w-52"
        onSubmit={(event) => {
          event.preventDefault();
          update("cidade", city.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input aria-label="Buscar por cidade" placeholder="Cidade" className="pl-9" value={city} onChange={(event) => setCity(event.target.value)} />
      </form>
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setCity("");
            router.replace(pathname);
          }}
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
