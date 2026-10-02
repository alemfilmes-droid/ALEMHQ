import Link from "next/link";
import { CalendarRange, Target } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CARD_LINK_CLASS, CardIcon } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { StatusDot } from "@/components/ui/status-dot";
import { GoalProgressBar } from "@/features/goals/components/goal-progress-bar";
import { contractRate, formatGoalValue, goalPace, percentOf } from "@/features/goals/progress";
import { GOAL_METRIC_LABELS, GOAL_STATUS_LABELS, GOAL_STATUS_TONE, type GoalItem } from "@/features/goals/types";
import { todayInAppZone } from "@/lib/calendar";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function GoalStatusBadge({ status }: { status: GoalItem["status"] }) {
  return (
    <Badge variant="outline" className="shrink-0">
      <StatusDot tone={GOAL_STATUS_TONE[status]} />
      {GOAL_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Uma linha curta sobre o ritmo: "3 dias à frente", "faltam R$ 2.111/dia", "meta batida". */
export function paceLine(goal: GoalItem, today: string): string {
  if (goal.status !== "ativa") return GOAL_STATUS_LABELS[goal.status];
  const pace = goalPace(goal, today);
  if (goal.approved >= goal.target) return "Meta batida!";
  if (pace.elapsedDays === 0) return `Começa em ${formatDateShort(goal.startsOn)}`;
  const perDay = `${formatGoalValue(goal, pace.perDayNeeded)}/dia`;
  const left = pace.daysLeft === 1 ? "último dia" : `faltam ${pace.daysLeft} dias`;
  return `${left} · ${perDay}`;
}

interface GoalCardProps {
  goal: GoalItem;
  /** Mostra quem é o responsável (visão da diretoria). */
  showOwner?: boolean;
  /** Card em destaque (Início e Avisos): borda no acento e números maiores. */
  highlight?: boolean;
  className?: string;
}

/** Card de meta: barra, % confirmado, comissão confirmada e a confirmar, ritmo. O card inteiro abre a meta. */
export function GoalCard({ goal, showOwner = false, highlight = false, className }: GoalCardProps) {
  const today = todayInAppZone();
  const pace = goal.status === "ativa" ? goalPace(goal, today) : null;
  const percent = percentOf(goal.approved, goal.target);
  const commissionReleased = percent >= goal.minAchievementPct;
  const contracts = goal.commissionMode === "contratos_fechados";
  const commissionLabel = contracts
    ? `${goal.closedCount} ${goal.closedCount === 1 ? "contrato fechado" : "contratos fechados"} · ${pct.format(contractRate(goal, goal.approved))}%${
        commissionReleased || goal.lockedRate != null ? "" : " (abaixo do mínimo)"
      }`
    : commissionReleased
      ? "Comissão confirmada"
      : `Comissão a partir de ${pct.format(goal.minAchievementPct)}%`;

  return (
    <Link
      href={`/metas/${goal.id}`}
      className={cn(CARD_LINK_CLASS, "gap-4 p-5", highlight && "border-brand-accent/50 ring-1 ring-brand-accent/30", className)}
    >
      <div className="flex items-start gap-3">
        <CardIcon icon={Target} tone={highlight ? "accent" : "success"} />
        <div className="min-w-0 flex-1 space-y-1">
          {highlight ? <p className="eyebrow">Meta ativa</p> : null}
          <p className="line-clamp-2 font-bold leading-snug">{goal.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-subtle">
            <span>{GOAL_METRIC_LABELS[goal.metric]}</span>
            <span className="flex items-center gap-1">
              <CalendarRange className="size-3" aria-hidden />
              {formatDateShort(goal.startsOn)} – {formatDateShort(goal.endsOn)}
            </span>
          </p>
        </div>
        {goal.status !== "ativa" || goal.pendingCount > 0 ? (
          goal.status === "ativa" ? (
            <Badge variant="outline" className="shrink-0">
              <StatusDot tone="warning" />
              {goal.pendingCount} a confirmar
            </Badge>
          ) : (
            <GoalStatusBadge status={goal.status} />
          )
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn("font-display font-black tabular-nums tracking-tight", highlight ? "text-3xl" : "text-2xl")}>{pct.format(percent)}%</span>
          <span className="truncate text-right text-sm text-muted-foreground">
            <span data-sensitive={goal.isMoney ? "money" : undefined} className="font-semibold text-foreground">
              {formatGoalValue(goal, goal.approved, false)}
            </span>{" "}
            de <span data-sensitive={goal.isMoney ? "money" : undefined}>{formatGoalValue(goal, goal.target)}</span>
          </span>
        </div>
        <GoalProgressBar
          target={goal.target}
          approved={goal.approved}
          pending={goal.pending}
          minAchievementPct={goal.minAchievementPct}
          expected={pace?.expected}
          size={highlight ? "md" : "sm"}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-border pt-3 text-[13px]">
        <div className="space-y-0.5">
          <p className="text-[12px] font-semibold text-muted-foreground">{commissionLabel}</p>
          <p className="font-bold">
            <Money cents={goal.status === "aprovada" && !contracts ? goal.finalCommission ?? 0 : goal.commissionConfirmed} />
            {goal.commissionPotential > goal.commissionConfirmed && goal.status !== "aprovada" ? (
              <span className="ml-2 font-semibold text-muted-foreground">
                + <Money cents={goal.commissionPotential - goal.commissionConfirmed} /> a confirmar
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {showOwner ? (
            <span className="flex items-center gap-1.5">
              <UserAvatar name={goal.ownerName} src={goal.ownerAvatarUrl} profileId={goal.ownerId} className="size-5" />
              <span className="font-semibold">{goal.ownerName}</span>
              <span aria-hidden>·</span>
            </span>
          ) : null}
          <span>{paceLine(goal, today)}</span>
        </div>
      </div>
    </Link>
  );
}
