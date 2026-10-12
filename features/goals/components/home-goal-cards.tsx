import Link from "next/link";
import { ClipboardCheck, Hourglass, Target } from "lucide-react";
import { CARD_LINK_CLASS, CardContent, CardHeading } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { GoalCard } from "@/features/goals/components/goal-card";
import { GoalProgressBar } from "@/features/goals/components/goal-progress-bar";
import { percentOf } from "@/features/goals/progress";
import { getGoalsReviewSummary, getMyActiveGoals, listGoals } from "@/features/goals/queries";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/**
 * Metas ativas da pessoa em destaque (Início e Avisos). Sem meta ativa, não renderiza nada.
 * `className` vai em cada card (ex.: card-span-2 na grade do Início).
 */
export async function MyGoalsHighlight({ profileId, className }: { profileId: string; className?: string }) {
  const goals = await getMyActiveGoals(profileId);
  if (goals.length === 0) return null;
  return (
    <>
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} highlight className={cn(className)} />
      ))}
    </>
  );
}

/** CEO/diretoria: card secundário com cada pessoa que tem meta ativa, o progresso e o prazo. */
export async function TeamGoalsCard() {
  const [goals, summary] = await Promise.all([listGoals("ativas"), getGoalsReviewSummary()]);
  if (goals.length === 0 && summary.awaiting === 0) return null;

  return (
    <Link href="/metas" className={CARD_LINK_CLASS}>
      <CardHeading icon={Target} tone="success" title="Metas da equipe" />
      <CardContent className="space-y-3">
        {summary.awaiting > 0 || summary.pendingEntries > 0 ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-muted-foreground">
            {summary.awaiting > 0 ? (
              <span className="flex items-center gap-1">
                <ClipboardCheck className="size-3.5" aria-hidden />
                {summary.awaiting} para finalizar
              </span>
            ) : null}
            {summary.pendingEntries > 0 ? (
              <span className="flex items-center gap-1">
                <Hourglass className="size-3.5" aria-hidden />
                {summary.pendingEntries} lançamentos a revisar
              </span>
            ) : null}
          </p>
        ) : null}
        <ul className="space-y-3">
          {goals.slice(0, 6).map((goal) => {
            const percent = percentOf(goal.approved, goal.target);
            return (
              <li key={goal.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={goal.ownerName} src={goal.ownerAvatarUrl} profileId={goal.ownerId} className="size-5" />
                    <span className="truncate font-semibold">{goal.ownerName.split(" ")[0]}</span>
                    <span className="truncate text-muted-foreground">· {goal.title}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{pct.format(percent)}%</span>
                </div>
                <GoalProgressBar target={goal.target} approved={goal.approved} pending={goal.pending} minAchievementPct={goal.minAchievementPct} size="sm" />
                <p className="text-[11px] text-subtle">até {formatDateShort(goal.endsOn)}</p>
              </li>
            );
          })}
        </ul>
        {goals.length > 6 ? <p className="text-[12px] text-muted-foreground">e mais {goals.length - 6} em /metas</p> : null}
      </CardContent>
    </Link>
  );
}
