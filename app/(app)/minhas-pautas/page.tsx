import type { Metadata } from "next";
import { Suspense } from "react";
import { MyCommitmentsSection } from "@/features/crm/components/my-commitments-section";
import { MyPautasBoard } from "@/features/minhas-pautas/components/my-pautas-board";
import { getMyPautasBoard } from "@/features/minhas-pautas/queries";
import { getPautaFormOptions } from "@/features/pautas/queries";
import { PanelIcon } from "@/components/layout/panel-icon";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { canFullyManagePauta } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";

export const metadata: Metadata = { title: "Minhas Pautas" };

type SearchParams = Promise<{ pauta?: string }>;

export default async function MinhasPautasPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { pauta } = await searchParams;

  const [board, options] = await Promise.all([getMyPautasBoard(profile.id), getPautaFormOptions()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <PanelIcon href="/minhas-pautas" />
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Minhas Pautas.</h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-subtle">
              <span>{profile.full_name}</span>
              {profile.job_title ? <span>· {profile.job_title}</span> : null}
              {profile.squads.map((squad) => (
                <Badge key={squad} variant="muted">
                  <StatusDot tone={SQUAD_TONE[squad]} />
                  {SQUAD_LABELS[squad]}
                </Badge>
              ))}
            </p>
          </div>
        </div>
      </div>

      <MyCommitmentsSection profileId={profile.id} />

      <Suspense>
        <MyPautasBoard
          board={board}
          options={options}
          canManage={canFullyManagePauta(profile)}
          initialOpenId={pauta}
          currentUser={{ id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }}
          mySquads={profile.squads}
        />
      </Suspense>
    </div>
  );
}
