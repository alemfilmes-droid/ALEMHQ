import Link from "next/link";
import { Clock } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { PontoLive } from "@/features/time-tracking/components/ponto-live";
import { TodayEntriesList } from "@/features/time-tracking/components/today-entries-list";
import { getOpenSessionState, getWorkSchedule } from "@/features/time-tracking/queries";

/** Card "Ponto do dia": não é um link inteiro (tem botões dentro) — por isso o link para o banco de horas fica no rodapé. */
export async function PontoCard({ profileId }: { profileId: string }) {
  const [state, schedule] = await Promise.all([getOpenSessionState(profileId), getWorkSchedule(profileId)]);
  const dailyMinutes = Math.round((schedule?.daily_hours ?? 8) * 60);

  return (
    <div className="card-elevated flex flex-col justify-between gap-6 rounded-lg border p-6 card-span-2">
      <div>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground">Ponto do dia</CardTitle>
          <Clock className="size-4 text-subtle" aria-hidden />
        </div>
        <div className="mt-3">
          <PontoLive
            closedSecondsToday={state.closedSecondsToday}
            openStartedAt={state.openEntry?.occurred_at ?? null}
            hasEntriesToday={state.hasEntriesToday}
            dailyMinutes={dailyMinutes}
          />
        </div>
      </div>

      <div className="space-y-4">
        <TodayEntriesList entries={state.todayEntries} />

        <Link href="/banco-de-horas" className="inline-block text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">
          Ver banco de horas
        </Link>
      </div>
    </div>
  );
}
