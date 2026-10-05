"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, ListChecks, Plus, Search, Workflow, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SquadBadge } from "@/components/ui/squad-badge";
import { Switch } from "@/components/ui/switch";
import { ProcessFormDialog } from "@/features/processes/components/process-form-dialog";
import { FREQUENCY_LABELS, type ProcessSummary } from "@/features/processes/types";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_PRIORITY, SURFACE, squadBarStyle, squadGradient } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types";

/** Busca sem acento e sem caixa. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface ProcessesBrowserProps {
  processes: ProcessSummary[];
  /** Squads que a pessoa pode filtrar (todos para diretoria/master; os dela para os demais). */
  squads: Squad[];
  /** Squads em que a pessoa cria/edita processos. */
  editableSquads: Squad[];
}

export function ProcessesBrowser({ processes, squads, editableSquads }: ProcessesBrowserProps) {
  const [query, setQuery] = useState("");
  const [squad, setSquad] = useState<Squad | "todos">("todos");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return processes.filter((process) => {
      if (squad !== "todos" && process.squad !== squad) return false;
      if (process.archived && !showArchived) return false;
      if (terms.length === 0) return true;
      const haystack = normalize(process.searchText);
      return terms.every((term) => haystack.includes(term));
    });
  }, [processes, query, squad, showArchived]);

  const groups = SQUAD_PRIORITY.map((key) => ({ squad: key, items: filtered.filter((process) => process.squad === key) })).filter((group) => group.items.length > 0);
  const hasArchived = processes.some((process) => process.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar em processos e passos (ex.: nota fiscal, brutos, cadência)"
            aria-label="Buscar nos fluxogramas"
            className="pl-9"
          />
        </div>
        {editableSquads.length > 0 ? (
          <Button type="button" onClick={() => setCreating(true)} className="shrink-0">
            <Plus aria-hidden />
            Novo fluxograma
          </Button>
        ) : null}
      </div>

      {squads.length > 1 || hasArchived ? (
        <div className="flex flex-wrap items-center gap-2">
          {squads.length > 1 ? (
            <>
              <FilterChip active={squad === "todos"} onClick={() => setSquad("todos")}>
                Todos
              </FilterChip>
              {squads.map((key) => (
                <FilterChip key={key} active={squad === key} onClick={() => setSquad(key)} squad={key}>
                  {SQUAD_LABELS[key]}
                </FilterChip>
              ))}
            </>
          ) : null}
          {hasArchived ? (
            <label className="ml-auto flex items-center gap-2 text-[13px] text-muted-foreground">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Mostrar arquivados
            </label>
          ) : null}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
          <Workflow className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="font-bold">{query ? "Nada encontrado." : "Nenhum fluxograma para os seus squads ainda."}</p>
          <p className="mt-1 text-sm text-muted-foreground">{query ? "Tente outra palavra." : "Quando a liderança publicar um processo do seu squad, ele aparece aqui."}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.squad} aria-labelledby={`squad-${group.squad}`} className="space-y-3">
            <h2 id={`squad-${group.squad}`} className="flex items-center gap-2">
              <SquadBadge squad={group.squad} />
              <span className="text-[12px] text-subtle">
                {group.items.length} {group.items.length === 1 ? "processo" : "processos"}
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((process) => (
                <ProcessCard key={process.id} process={process} />
              ))}
            </div>
          </section>
        ))
      )}

      {creating ? <ProcessFormDialog squads={editableSquads} onOpenChange={setCreating} /> : null}
    </div>
  );
}

function FilterChip({ active, onClick, squad, children }: { active: boolean; onClick: () => void; squad?: Squad; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        active ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {squad ? <span aria-hidden className="size-2 rounded-full" style={squadBarStyle(squad)} /> : null}
      {children}
    </button>
  );
}

function ProcessCard({ process }: { process: ProcessSummary }) {
  const gradient = squadGradient(process.squad, 9);
  return (
    <Link
      href={`/fluxogramas/${process.slug}`}
      className={cn(SURFACE.card, "relative flex h-full flex-col gap-3 overflow-hidden rounded-lg p-4 pl-5 outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      style={gradient ? { backgroundImage: `${gradient}, linear-gradient(180deg, var(--surface-card-from), var(--surface-card-to))` } : undefined}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={squadBarStyle(process.squad)} />
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-snug">{process.title}</p>
        <span className="flex shrink-0 gap-1">
          {!process.isPublished ? <Badge variant="outline">Rascunho</Badge> : null}
          {process.archived ? <Badge variant="muted">Arquivado</Badge> : null}
        </span>
      </div>
      {process.summary ? <p className="line-clamp-2 text-[13px] text-muted-foreground">{process.summary}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-[12px] text-subtle">
        <span className="flex items-center gap-1">
          <Clock className="size-3" aria-hidden />
          {FREQUENCY_LABELS[process.frequency]}
        </span>
        <span className="flex items-center gap-1">
          <ListChecks className="size-3" aria-hidden />
          {process.stepCount} {process.stepCount === 1 ? "passo" : "passos"}
        </span>
        {process.ownerRole ? <span>{process.ownerRole}</span> : null}
        {process.triggerDescription ? (
          <span className="flex min-w-0 items-center gap-1">
            <Zap className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{process.triggerDescription}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
