"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, KanbanSquare, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PautaDetailModal } from "@/features/pautas/components/pauta-detail-modal";
import {
  KANBAN_DIMENSIONS,
  KANBAN_DIMENSION_LABELS,
  countBySquad,
  matchesFilters,
  parseDimension,
  parseView,
  type KanbanDimension,
  type MyPautasView,
} from "@/features/minhas-pautas/board";
import { MyPautasCalendar } from "@/features/minhas-pautas/components/my-pautas-calendar";
import { MyPautasKanban } from "@/features/minhas-pautas/components/my-pautas-kanban";
import { MyPautasList } from "@/features/minhas-pautas/components/my-pautas-list";
import { MyPautasSummaryStrip } from "@/features/minhas-pautas/components/my-pautas-summary";
import { NewTaskDialog } from "@/features/minhas-pautas/components/new-task-dialog";
import type { MyPautasBoard as MyPautasBoardData } from "@/features/minhas-pautas/types";
import type { PautaFormOptions } from "@/features/pautas/types";
import { SQUADS, SQUAD_LABELS } from "@/lib/auth/squads";
import { isDateOnly, startOfWeek, todayInAppZone } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { PautaWithDetails, Squad } from "@/types";

interface MyPautasBoardProps {
  board: MyPautasBoardData;
  options: PautaFormOptions;
  canManage: boolean;
  initialOpenId?: string;
  currentUser: { id: string; full_name: string; avatar_url: string | null };
  mySquads: Squad[];
}

const VIEW_OPTIONS: { view: MyPautasView; label: string; icon: typeof List }[] = [
  { view: "lista", label: "Lista", icon: List },
  { view: "quadro", label: "Quadro", icon: KanbanSquare },
  { view: "calendario", label: "Calendário", icon: CalendarDays },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: typeof List }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={label}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn("gap-1.5", value === option.value && "bg-surface-hover font-bold text-foreground")}
          >
            {Icon ? <Icon className="size-4" aria-hidden /> : null}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Quadro pessoal com três visões (Lista, Quadro, Calendário) sobre a MESMA fonte de dados, os mesmos
 * filtros e o mesmo modal de pauta. Visão, agrupamento, semana e squad ficam na URL — trocar de
 * visão não recarrega dados do servidor (history.replaceState, que o Next sincroniza com useSearchParams).
 */
export function MyPautasBoard({ board, options, canManage, initialOpenId, currentUser, mySquads }: MyPautasBoardProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [rows, setRows] = useState<Record<string, PautaWithDetails>>({});
  const [search, setSearch] = useState("");

  const multiSquad = mySquads.length > 1;
  const view = parseView(searchParams.get("visao"));
  const dimension = parseDimension(searchParams.get("agrupar"), mySquads.length);
  const activeSquad = SQUADS.find((squad) => squad === searchParams.get("squad")) ?? null;
  const weekParam = searchParams.get("semana");
  const monday = startOfWeek(isDateOnly(weekParam) ? weekParam : todayInAppZone());

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  function handleChanged(pauta: PautaWithDetails) {
    setRows((current) => ({ ...current, [pauta.id!]: pauta }));
  }

  // Junta as edições otimistas (modal, arrasto) aos dados do servidor, para refletir na hora em
  // todas as visões sem esperar o próximo carregamento (revalidatePath cobre o próximo acesso).
  function withOverrides(list: PautaWithDetails[]): PautaWithDetails[] {
    return list.map((pauta) => (pauta.id && rows[pauta.id] ? { ...pauta, ...rows[pauta.id] } : pauta));
  }

  const all: MyPautasBoardData = {
    atrasadas: withOverrides(board.atrasadas),
    hoje: withOverrides(board.hoje),
    estaSemana: withOverrides(board.estaSemana),
    depois: withOverrides(board.depois),
    acompanhando: withOverrides(board.acompanhando),
    devolvidas: withOverrides(board.devolvidas),
  };
  const allMine = [...all.atrasadas, ...all.hoje, ...all.estaSemana, ...all.depois, ...all.acompanhando];

  const filters = { squad: activeSquad, search };
  const only = (list: PautaWithDetails[]) => list.filter((pauta) => matchesFilters(pauta, filters));
  const filtered: MyPautasBoardData = {
    atrasadas: only(all.atrasadas),
    hoje: only(all.hoje),
    estaSemana: only(all.estaSemana),
    depois: only(all.depois),
    acompanhando: only(all.acompanhando),
    devolvidas: only(all.devolvidas),
  };
  const filteredMine = only(allMine);
  const hasFilters = Boolean(activeSquad || search.trim());

  const summary = {
    atrasadas: all.atrasadas.length,
    hoje: all.hoje.length,
    estaSemana: all.estaSemana.length,
    acompanhando: all.acompanhando.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <MyPautasSummaryStrip
          summary={summary}
          squadCounts={multiSquad ? countBySquad(allMine) : undefined}
          activeSquad={activeSquad}
          onSquadToggle={(squad) => setParams({ squad: activeSquad === squad ? null : squad })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <NewTaskDialog squads={mySquads} />
          <Segmented
            label="Visão"
            value={view}
            options={VIEW_OPTIONS.map((option) => ({ value: option.view, label: option.label, icon: option.icon }))}
            onChange={(next) => setParams({ visao: next === "lista" ? null : next })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por pauta, cliente ou projeto"
            aria-label="Buscar nas minhas pautas"
            className="h-9 pl-9"
          />
        </div>
        {view === "quadro" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Agrupar por</span>
            <Segmented<KanbanDimension>
              label="Agrupar o quadro por"
              value={dimension}
              options={KANBAN_DIMENSIONS.map((item) => ({ value: item, label: KANBAN_DIMENSION_LABELS[item] }))}
              onChange={(next) => setParams({ agrupar: next })}
            />
          </div>
        ) : null}
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setParams({ squad: null });
            }}
          >
            <X aria-hidden />
            Limpar filtros{activeSquad ? ` (${SQUAD_LABELS[activeSquad]})` : ""}
          </Button>
        ) : null}
      </div>

      {view === "lista" ? (
        <MyPautasList board={filtered} currentUserId={currentUser.id} onOpen={setOpenId} showSquad={multiSquad} filtered={hasFilters} />
      ) : view === "quadro" ? (
        <MyPautasKanban
          pautas={filteredMine}
          dimension={dimension}
          mySquads={mySquads}
          currentUserId={currentUser.id}
          canManage={canManage}
          onOpen={setOpenId}
          onChanged={handleChanged}
        />
      ) : (
        <MyPautasCalendar
          pautas={filteredMine}
          monday={monday}
          onWeekChange={(next) => setParams({ semana: next === startOfWeek(todayInAppZone()) ? null : next })}
          onOpen={setOpenId}
          showSquad={multiSquad}
        />
      )}

      {openId ? (
        <PautaDetailModal
          pautaId={openId}
          options={options}
          canManage={canManage}
          currentUser={currentUser}
          open
          onOpenChange={(next) => !next && setOpenId(null)}
          onChanged={handleChanged}
        />
      ) : null}
    </div>
  );
}
