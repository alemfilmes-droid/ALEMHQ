import type { Metadata } from "next";
import { PanelIcon } from "@/components/layout/panel-icon";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PautasBoard } from "@/features/pautas/components/pautas-board";
import { PautasCounters } from "@/features/pautas/components/pautas-counters";
import { summarizePautas } from "@/features/pautas/board";
import { getPautaFormOptions, listPautas } from "@/features/pautas/queries";
import { parsePautaFilters, pautaFiltersKey } from "@/features/pautas/filters";
import { canCreateProjectPauta, canFullyManagePauta, hasCapability, managedSquads } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pautas" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function PautasPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  // Defesa em profundidade: a RLS e o middleware já bloqueiam quem não gerencia pautas.
  if (!hasCapability(profile, "managePautas")) redirect("/minhas-pautas");
  const params = await searchParams;
  const canManage = canFullyManagePauta(profile);
  const scopedSquads = managedSquads(profile);
  const scopeLabel = scopedSquads.length === 4 ? "Todos os squads" : scopedSquads.map((squad) => SQUAD_LABELS[squad]).join(", ") || "Nenhum squad";

  // URL → filtros validados → consulta no servidor (RLS por baixo). Os contadores do topo são
  // calculados da mesma lista filtrada, então acompanham cada filtro.
  const filters = parsePautaFilters(params);

  const supabase = await createClient();
  const [pautas, options, companies] = await Promise.all([
    listPautas(filters),
    getPautaFormOptions(),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  const summary = summarizePautas(pautas);

  return (
    /*
      Regra crítica de layout: a página não rola — só cada coluna do quadro rola.
      A altura total é o viewport menos a topbar (4rem) e o padding vertical do <main> do
      AppShell (py-8 = 4rem no mobile, sm:py-10 = 5rem a partir do sm) — acoplado a esses
      valores; se mudarem em components/layout/app-shell.tsx, ajuste aqui também. O cabeçalho
      e os filtros ficam com altura natural (shrink-0); o quadro ocupa o restante (min-h-0 flex-1).
    */
    <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col sm:h-[calc(100dvh-9rem)]">
      <div className="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <PanelIcon href="/pautas" />
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Pautas.</h1>
            <p className="text-xs text-subtle">
              {profile.full_name} · {profile.job_title || ROLE_LABELS[profile.access_role]}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{scopeLabel}</p>
          </div>
        </div>
        <PautasCounters summary={summary} />
      </div>

      <Suspense>
        <PautasBoard
          initialPautas={pautas}
          options={options}
          companies={companies.data ?? []}
          canManage={canManage}
          canCreate={canCreateProjectPauta(profile)}
          canCreateProjects={hasCapability(profile, "manageProjects")}
          initialOpenId={params.pauta}
          currentUser={{ id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, squads: profile.squads }}
          filtersKey={pautaFiltersKey(filters)}
        />
      </Suspense>
    </div>
  );
}
