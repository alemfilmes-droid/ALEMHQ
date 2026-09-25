"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MODEL_LABELS, MODELS, PROJECT_STAGES, STAGE_LABELS } from "@/lib/domain";

const ALL = "all";

interface ProjectFiltersProps {
  companies: { id: string; name: string }[];
}

export function ProjectFilters({ companies }: ProjectFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("busca") ?? "");
  const view = searchParams.get("visao") === "quadro" ? "quadro" : "lista";
  const onlyMine = searchParams.get("meus") === "1";

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || value === "") params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["modelo", "cliente", "etapa", "busca", "meus"].some((key) => searchParams.has(key));

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="md:w-44">
          <Select value={searchParams.get("modelo") ?? ALL} onValueChange={(value) => update("modelo", value)}>
            <SelectTrigger aria-label="Filtrar por modelo">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {MODELS.map((item) => (
                <SelectItem key={item} value={item}>
                  {MODEL_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:w-56">
          <Select value={searchParams.get("cliente") ?? ALL} onValueChange={(value) => update("cliente", value)}>
            <SelectTrigger aria-label="Filtrar por cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os clientes</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:w-52">
          <Select value={searchParams.get("etapa") ?? ALL} onValueChange={(value) => update("etapa", value)}>
            <SelectTrigger aria-label="Filtrar por etapa">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as etapas</SelectItem>
              {PROJECT_STAGES.map((item) => (
                <SelectItem key={item} value={item}>
                  {STAGE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <form
          className="relative md:w-52"
          onSubmit={(event) => {
            event.preventDefault();
            update("busca", search.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input aria-label="Buscar projeto" placeholder="Buscar projeto" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </form>
        <div className="flex items-center gap-2">
          <Switch id="only-mine" checked={onlyMine} onCheckedChange={(checked) => update("meus", checked ? "1" : "")} />
          <Label htmlFor="only-mine" className="cursor-pointer font-normal">
            Somente meus projetos
          </Label>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              router.replace(pathname);
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-1 self-start rounded-md border border-border p-0.5">
        <Button variant={view === "lista" ? "secondary" : "ghost"} size="sm" onClick={() => update("visao", "")}>
          <List aria-hidden />
          Lista
        </Button>
        <Button variant={view === "quadro" ? "secondary" : "ghost"} size="sm" onClick={() => update("visao", "quadro")}>
          <LayoutGrid aria-hidden />
          Quadro
        </Button>
      </div>
    </div>
  );
}
