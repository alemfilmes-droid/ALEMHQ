import Link from "next/link";
import { ClipboardCheck, Hourglass, Target } from "lucide-react";
import { CARD_LINK_CLASS, CardContent, CardHeading } from "@/components/ui/card";
import { Metric, MetricGrid } from "@/components/ui/metric-value";
import { GoalCard } from "@/features/goals/components/goal-card";
import { getGoalsReviewSummary, getMyActiveGoals } from "@/features/goals/queries";
import { cn } from "@/lib/utils";

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

/** Diretoria: metas da equipe e o que espera revisão. */
export async function TeamGoalsCard() {
  const summary = await getGoalsReviewSummary();
  if (summary.active === 0 && summary.awaiting === 0) return null;

  return (
    <Link href="/metas" className={CARD_LINK_CLASS}>
      <CardHeading icon={Target} tone="success" title="Metas da equipe" />
      <CardContent>
        <MetricGrid min="7rem">
          <Metric label="Em andamento" value={summary.active} />
          <Metric label="Para revisar" icon={ClipboardCheck} value={summary.awaiting} tone={summary.awaiting > 0 ? "warning" : undefined} />
          <Metric label="Lançamentos pendentes" icon={Hourglass} value={summary.pendingEntries} />
        </MetricGrid>
      </CardContent>
    </Link>
  );
}
