"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { MemberPicker } from "@/components/projects/member-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchSelect } from "@/components/ui/search-select";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { getCommitmentFormAction } from "@/features/agenda/actions";
import { AgendaList } from "@/features/agenda/components/agenda-list";
import { AgendaMonth } from "@/features/agenda/components/agenda-month";
import { AgendaTimeGrid } from "@/features/agenda/components/agenda-time-grid";
import { CommitmentDialog, type CommitmentDialogTarget } from "@/features/agenda/components/commitment-dialog";
import { EventDetailDialog } from "@/features/agenda/components/event-detail-dialog";
import { shiftAnchor, viewRange } from "@/features/agenda/layout";
import { COMMITMENT_KINDS } from "@/features/agenda/schemas";
import { AGENDA_VIEWS, AGENDA_VIEW_LABELS, type AgendaEvent, type AgendaFormOptions, type AgendaView as AgendaViewMode } from "@/features/agenda/types";
import { COMMITMENT_KIND_LABELS } from "@/features/crm/labels";
import { addDays, dayMonthShort, daysBetween, monthYearLabel, todayInAppZone, weekRangeLabel, weekdayLong } from "@/lib/calendar";
import { COMMITMENT_KIND_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { CommitmentKind } from "@/types";

export interface AgendaFilters {
  kinds: CommitmentKind[];
  people: string[];
  companyId: string;
  projectId: string;
  onlyMine: boolean;
}

interface AgendaViewProps {
  view: AgendaViewMode;
  anchor: string;
  events: AgendaEvent[];
  filters: AgendaFilters;
  options: AgendaFormOptions;
  currentUserId: string;
  /** Diretoria e heads filtram por pessoa. */
  canFilterPeople: boolean;
  openCommitmentId?: string;
}

function rangeLabel(view: AgendaViewMode, anchor: string): string {
  const { from, toExclusive } = viewRange(view, anchor);
  switch (view) {
    case "mes":
      return monthYearLabel(anchor);
    case "semana":
      return weekRangeLabel(from);
    case "dia":
      return `${weekdayLong(anchor)}, ${dayMonthShort(anchor)}`;
    case "agenda":
      return `${dayMonthShort(from)} – ${dayMonthShort(addDays(toExclusive, -1))}`;
  }
}

function pad(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Agenda: Mês, Semana, Dia e Agenda (lista). Visão, data e filtros vivem na URL (o servidor busca o
 * intervalo certo); criar/editar/cancelar abre diálogos por cima, sem sair da página.
 */
export function AgendaView({ view, anchor, events, filters, options, currentUserId, canFilterPeople, openCommitmentId }: AgendaViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  const [detail, setDetail] = useState<AgendaEvent | null>(null);
  const [dialog, setDialog] = useState<CommitmentDialogTarget | null>(null);
  const today = todayInAppZone();

  // Link de notificação (?compromisso=<id>): abre o detalhe assim que a página carrega.
  useEffect(() => {
    if (!openCommitmentId) return;
    const target = events.find((event) => event.commitmentId === openCommitmentId && !event.busyOnly);
    if (target) setDetail(target);
  }, [openCommitmentId, events]);

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compromisso");
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startNavigation(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function toggleKind(kind: CommitmentKind) {
    const next = filters.kinds.includes(kind) ? filters.kinds.filter((item) => item !== kind) : [...filters.kinds, kind];
    navigate({ tipo: next.length > 0 && next.length < COMMITMENT_KINDS.length ? next.join(",") : null });
  }

  async function openEdit(commitmentId: string) {
    const row = await getCommitmentFormAction(commitmentId);
    if (!row) {
      toast.error("Não foi possível abrir este compromisso.");
      return;
    }
    setDetail(null);
    setDialog({ mode: "edit", row });
  }

  function afterChange() {
    setDialog(null);
    setDetail(null);
    router.refresh();
  }

  const range = viewRange(view, anchor);
  const peopleLabel =
    filters.people.length === 0
      ? "Todas as pessoas"
      : filters.people.length === 1
        ? (options.members.find((member) => member.id === filters.people[0])?.full_name ?? "1 pessoa")
        : `${filters.people.length} pessoas`;

  return (
    <div className={cn("space-y-5 transition-opacity", navigating && "opacity-60")}>
      {/* Navegação e visão */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" className="size-9" onClick={() => navigate({ data: shiftAnchor(view, anchor, -1) })} aria-label="Anterior">
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="secondary" size="icon" className="size-9" onClick={() => navigate({ data: shiftAnchor(view, anchor, 1) })} aria-label="Próximo">
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <Button variant="secondary" size="sm" className="h-9" onClick={() => navigate({ data: null })}>
            Hoje
          </Button>
          <p className="ml-1 text-base font-bold first-letter:uppercase" aria-live="polite">
            {rangeLabel(view, anchor)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Visão da agenda">
            {AGENDA_VIEWS.map((item) => (
              <Button
                key={item}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={view === item}
                onClick={() => navigate({ visao: item === "semana" ? null : item })}
                className={cn(view === item && "bg-surface-hover font-bold text-foreground")}
              >
                {AGENDA_VIEW_LABELS[item]}
              </Button>
            ))}
          </div>
          <Button onClick={() => setDialog({ mode: "create", date: anchor < today && view !== "dia" ? today : anchor })}>
            <Plus aria-hidden />
            Novo compromisso
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de compromisso">
          {COMMITMENT_KINDS.map((kind) => {
            const active = filters.kinds.length === 0 || filters.kinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={filters.kinds.includes(kind)}
                onClick={() => toggleKind(kind)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                  filters.kinds.includes(kind) ? "border-foreground text-foreground" : "border-border-strong text-muted-foreground hover:text-foreground",
                  !active && "opacity-50",
                )}
              >
                <StatusDot tone={COMMITMENT_KIND_TONE[kind]} />
                {COMMITMENT_KIND_LABELS[kind]}
              </button>
            );
          })}
        </div>

        {canFilterPeople ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8">
                <UserRound aria-hidden />
                {peopleLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2">
              <MemberPicker
                idPrefix="agenda-person"
                legend="Filtrar por pessoa"
                value={filters.people}
                onChange={(next) => navigate({ pessoa: next.join(",") || null, meus: null })}
                members={options.members}
              />
            </PopoverContent>
          </Popover>
        ) : null}

        <div className="w-56">
          <SearchSelect
            id="agenda-company"
            value={filters.companyId}
            onChange={(value) => navigate({ cliente: value || null, projeto: null })}
            options={options.companies.map((company) => ({
              value: company.id,
              label: company.name,
              leading: <ClientAvatar name={company.name} logoUrl={company.logo_url} size="sm" />,
            }))}
            placeholder="Todos os clientes"
          />
        </div>
        <div className="w-56">
          <SearchSelect
            id="agenda-project"
            value={filters.projectId}
            onChange={(value) => navigate({ projeto: value || null })}
            options={options.projects
              .filter((project) => !filters.companyId || project.company_id === filters.companyId)
              .map((project) => ({ value: project.id, label: project.name }))}
            placeholder="Todos os projetos"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Switch id="agenda-only-mine" checked={filters.onlyMine} onCheckedChange={(checked) => navigate({ meus: checked ? "1" : null, pessoa: null })} />
          <Label htmlFor="agenda-only-mine" className="text-[13px]">
            Somente meus compromissos
          </Label>
        </div>
      </div>

      {view === "mes" ? (
        <AgendaMonth gridStart={range.from} month={anchor.slice(0, 7)} events={events} onOpen={setDetail} onOpenDay={(day) => navigate({ visao: "dia", data: day })} />
      ) : view === "agenda" ? (
        <AgendaList events={events} onOpen={setDetail} />
      ) : (
        <AgendaTimeGrid
          days={view === "dia" ? [anchor] : daysBetween(range.from, 7)}
          events={events}
          onOpen={setDetail}
          onCreateAt={(day, hour) => setDialog({ mode: "create", date: day, startTime: pad(hour), endTime: hour >= 23 ? "23:59" : pad(hour + 1) })}
        />
      )}

      {detail ? (
        <EventDetailDialog
          event={detail}
          members={options.members}
          onOpenChange={(open) => !open && setDetail(null)}
          onEdit={(id) => void openEdit(id)}
          onCancelled={afterChange}
        />
      ) : null}

      {dialog ? (
        <CommitmentDialog target={dialog} options={options} currentUserId={currentUserId} onOpenChange={(open) => !open && setDialog(null)} onSaved={afterChange} />
      ) : null}
    </div>
  );
}
