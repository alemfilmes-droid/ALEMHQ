import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AgendaView, type AgendaFilters } from "@/features/agenda/components/agenda-view";
import { viewRange } from "@/features/agenda/layout";
import { getAgendaEvents, getAgendaFormOptions } from "@/features/agenda/queries";
import { COMMITMENT_KINDS } from "@/features/agenda/schemas";
import { AGENDA_VIEWS, type AgendaView as AgendaViewMode } from "@/features/agenda/types";
import { canFilterAgendaByPerson } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { dayRangeIso, isDateOnly, todayInAppZone } from "@/lib/calendar";
import type { CommitmentKind } from "@/types";

export const metadata: Metadata = { title: "Agenda" };

type SearchParams = Promise<{
  visao?: string;
  data?: string;
  tipo?: string;
  pessoa?: string;
  cliente?: string;
  projeto?: string;
  meus?: string;
  compromisso?: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const params = await searchParams;

  const view: AgendaViewMode = AGENDA_VIEWS.find((item) => item === params.visao) ?? "semana";
  const anchor = isDateOnly(params.data) ? params.data : todayInAppZone();
  const canFilterPeople = canFilterAgendaByPerson(profile);
  const filters: AgendaFilters = {
    kinds: (params.tipo ?? "").split(",").filter((item): item is CommitmentKind => (COMMITMENT_KINDS as readonly string[]).includes(item)),
    people: canFilterPeople ? (params.pessoa ?? "").split(",").filter((item) => UUID.test(item)) : [],
    companyId: params.cliente && UUID.test(params.cliente) ? params.cliente : "",
    projectId: params.projeto && UUID.test(params.projeto) ? params.projeto : "",
    onlyMine: params.meus === "1",
  };

  const range = viewRange(view, anchor);
  const { from, to } = dayRangeIso(range.from, range.toExclusive);
  const [feed, options] = await Promise.all([
    getAgendaEvents({ from, to, people: filters.people, onlyMine: filters.onlyMine }),
    getAgendaFormOptions(),
  ]);

  // Tipo, cliente e projeto filtram o que o feed já liberou (privados de outros ficam de fora: não têm vínculo visível).
  const events = feed.filter(
    (event) =>
      (filters.kinds.length === 0 || filters.kinds.includes(event.kind)) &&
      (!filters.companyId || event.companyId === filters.companyId) &&
      (!filters.projectId || event.projectId === filters.projectId),
  );

  return (
    <>
      <PageHeader
        panel="/agenda"
        title="Agenda."
        description="Reuniões, captações e entregas da equipe. Pautas agendadas entram sozinhas na agenda do líder e dos responsáveis."
      />
      <Suspense>
        <AgendaView
          view={view}
          anchor={anchor}
          events={events}
          filters={filters}
          options={options}
          currentUserId={profile.id}
          canFilterPeople={canFilterPeople}
          openCommitmentId={params.compromisso && UUID.test(params.compromisso) ? params.compromisso : undefined}
        />
      </Suspense>
    </>
  );
}
