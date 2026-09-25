"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCESS_ROLES, FUNCTION_LABELS, PRODUCTION_FUNCTIONS, ROLE_LABELS } from "@/lib/auth/roles";

const ALL = "all";

export function TeamFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = searchParams.get("papel") ?? ALL;
  const fn = searchParams.get("funcao") ?? ALL;

  function update(key: "papel" | "funcao", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const hasFilters = role !== ALL || fn !== ALL;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="sm:w-52">
        <Select value={role} onValueChange={(value) => update("papel", value)}>
          <SelectTrigger aria-label="Filtrar por papel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os papéis</SelectItem>
            {ACCESS_ROLES.map((item) => (
              <SelectItem key={item} value={item}>
                {ROLE_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:w-52">
        <Select value={fn} onValueChange={(value) => update("funcao", value)}>
          <SelectTrigger aria-label="Filtrar por função">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as funções</SelectItem>
            {PRODUCTION_FUNCTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {FUNCTION_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters ? (
        <Button variant="ghost" onClick={() => router.replace(pathname)}>
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
