import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, Coins, Gauge, Hourglass, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { Metric, MetricGrid } from "@/components/ui/metric-value";
import { RichText } from "@/components/ui/rich-text";
import { EntriesTable } from "@/features/goals/components/entries-table";
import { GoalActions } from "@/features/goals/components/goal-actions";
import { GoalStatusBadge } from "@/features/goals/components/goal-card";
import { GoalProgressBar } from "@/features/goals/components/goal-progress-bar";
import { formatCommissionRule, formatGoalValue, goalPace, percentOf } from "@/features/goals/progress";
import { getGoal, getPaymentDetails, listGoalEntries, listGoalOwnerOptions } from "@/features/goals/queries";
import { GOAL_METRIC_LABELS } from "@/features/goals/types";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { todayInAppZone } from "@/lib/calendar";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Meta" };

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const isManager = hasCapability(profile, "manageCompany");
  const canSeeFinance = hasCapability(profile, "finance");
  const goal = await getGoal(id);
  if (!goal) notFound();

  const [entries, owners, payee] = await Promise.all([
    listGoalEntries(id),
    isManager ? listGoalOwnerOptions() : Promise.resolve([]),
    isManager && canSeeFinance ? getPaymentDetails(goal.ownerId) : Promise.resolve(undefined),
  ]);

  const today = todayInAppZone();
  const pace = goalPace(goal, today);
  const percent = percentOf(goal.approved, goal.target);
  const remaining = Math.max(goal.target - goal.approved, 0);
  const dailyTarget = pace.totalDays > 0 ? goal.target / pace.totalDays : 0;
  const gapDays = dailyTarget > 0 ? Math.round(pace.gap / dailyTarget) : 0;
  const isActive = goal.status === "ativa";
  const approved = goal.status === "aprovada";

  const paceNote = !isActive
    ? undefined
    : pace.elapsedDays === 0
      ? "Ainda não começou"
      : goal.approved >= goal.target
        ? "Meta batida"
        : gapDays > 0
          ? `${gapDays} ${gapDays === 1 ? "dia" : "dias"} à frente do ritmo`
          : gapDays < 0
            ? `${-gapDays} ${gapDays === -1 ? "dia" : "dias"} atrás do ritmo`
            : "No ritmo";

  return (
    <>
      <PageHeader
        panel="/metas"
        eyebrow={GOAL_METRIC_LABELS[goal.metric]}
        title={goal.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <GoalStatusBadge status={goal.status} />
            <span className="flex items-center gap-1.5">
              <UserAvatar name={goal.ownerName} src={goal.ownerAvatarUrl} profileId={goal.ownerId} className="size-5" />
              {goal.ownerName}
            </span>
            <span className="flex items-center gap-1">
              <CalendarRange className="size-3.5" aria-hidden />
              {formatDate(goal.startsOn)} a {formatDate(goal.endsOn)}
            </span>
          </span>
        }
        actions={<GoalActions goal={goal} isManager={isManager} owners={owners} payeeHasDetails={payee === undefined ? null : payee !== null} />}
      />

      <div className="space-y-8">
        <Card variant="static">
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Confirmado</p>
                <p className="font-display text-5xl font-black tabular-nums tracking-tight">{pct.format(percent)}%</p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                <span data-sensitive={goal.isMoney ? "money" : undefined} className="text-lg font-bold text-foreground">
                  {formatGoalValue(goal, goal.approved, false)}
                </span>{" "}
                de <span data-sensitive={goal.isMoney ? "money" : undefined}>{formatGoalValue(goal, goal.target)}</span>
              </p>
            </div>
            <GoalProgressBar
              target={goal.target}
              approved={goal.approved}
              pending={goal.pending}
              minAchievementPct={goal.minAchievementPct}
              expected={isActive ? pace.expected : undefined}
            />
            <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-[12px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2 w-4 rounded-full bg-[var(--status-success)]" />
                Aprovado
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-4 rounded-full"
                  style={{ background: "repeating-linear-gradient(135deg, var(--status-warning) 0 3px, transparent 3px 6px)" }}
                />
                A confirmar
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-3 w-0.5 rounded-full bg-foreground/70" />
                Comissão a partir de {pct.format(goal.minAchievementPct)}%
              </li>
              {isActive ? (
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-0 border-x-[5px] border-b-[6px] border-x-transparent border-b-muted-foreground" />
                  Onde deveria estar hoje
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card variant="static">
            <CardHeading icon={Gauge} tone="success" title="Andamento" />
            <CardContent>
              <MetricGrid min="8rem">
                <Metric
                  label="A confirmar"
                  icon={Hourglass}
                  value={goal.isMoney ? goal.pending : formatGoalValue(goal, goal.pending)}
                  format={goal.isMoney ? "cents" : "text"}
                  tone={goal.pending > 0 ? "warning" : undefined}
                  note={goal.pendingCount > 0 ? `${goal.pendingCount} ${goal.pendingCount === 1 ? "lançamento" : "lançamentos"}` : undefined}
                />
                <Metric label="Falta" value={goal.isMoney ? remaining : formatGoalValue(goal, remaining)} format={goal.isMoney ? "cents" : "text"} />
                {isActive ? (
                  <Metric
                    label="Por dia, para bater"
                    icon={TrendingUp}
                    value={goal.isMoney ? pace.perDayNeeded : formatGoalValue(goal, pace.perDayNeeded)}
                    format={goal.isMoney ? "cents" : "text"}
                    note={pace.daysLeft === 1 ? "Último dia" : `${pace.daysLeft} dias restantes`}
                  />
                ) : null}
                {isActive ? (
                  <Metric
                    label="Ritmo"
                    value={paceNote}
                    format="text"
                    tone={gapDays < 0 ? "danger" : gapDays > 0 ? "success" : undefined}
                    size="sm"
                  />
                ) : null}
              </MetricGrid>
            </CardContent>
          </Card>

          <Card variant="static">
            <CardHeading icon={Coins} tone="alert" title="Comissão" sensitive />
            <CardContent className="space-y-4">
              <MetricGrid min="8rem">
                {approved ? (
                  <Metric label="Comissão final" icon={Wallet} value={goal.finalCommission ?? 0} format="cents" tone="success" />
                ) : (
                  <>
                    <Metric label="Confirmada" icon={Wallet} value={goal.commissionConfirmed} format="cents" tone={goal.commissionConfirmed > 0 ? "success" : undefined} />
                    <Metric label="Com os pendentes" value={goal.commissionPotential} format="cents" tone="warning" />
                    {isActive && pace.elapsedDays > 0 ? (
                      <Metric
                        label="Projeção no fim"
                        value={pace.projectedCommission}
                        format="cents"
                        note={`Se mantiver o ritmo: ${formatGoalValue(goal, pace.projected)}`}
                      />
                    ) : null}
                  </>
                )}
              </MetricGrid>
              <p className="text-[13px] text-muted-foreground">{formatCommissionRule(goal)}.</p>
              {approved && goal.payableId && canSeeFinance ? (
                <Link href="/financeiro?aba=pagamentos" className="inline-block text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">
                  Ver o pagamento no financeiro
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {goal.description ? (
          <Card variant="static">
            <CardContent className="pt-6">
              <p className="eyebrow mb-2">Regras combinadas</p>
              <RichText source={goal.description} className="text-sm" />
            </CardContent>
          </Card>
        ) : null}

        <EntriesTable goal={goal} entries={entries} isManager={isManager} isOwner={goal.ownerId === profile.id} />
      </div>
    </>
  );
}
