import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { GoalCard } from "@/features/goals/components/goal-card";
import { GoalsEmpty, NewGoalButton } from "@/features/goals/components/goals-board";
import { listGoalOwnerOptions, listGoals } from "@/features/goals/queries";
import { GOAL_TABS, GOAL_TAB_LABELS, type GoalTab } from "@/features/goals/types";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Metas" };

type SearchParams = Promise<{ aba?: string }>;

export default async function GoalsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const isManager = hasCapability(profile, "manageCompany");
  const tab: GoalTab = GOAL_TABS.find((item) => item === params.aba) ?? "ativas";
  // A RLS já devolve só as metas da pessoa para quem não é diretoria.
  const [goals, owners] = await Promise.all([listGoals(tab), isManager ? listGoalOwnerOptions() : Promise.resolve([])]);

  return (
    <>
      <PageHeader
        panel="/metas"
        eyebrow="Comercial"
        title="Metas."
        description={
          isManager
            ? "Metas com comissão: você define, a pessoa alimenta, você revisa e aprova. A comissão aprovada vira pagamento no financeiro."
            : "Suas metas, o quanto já foi confirmado e quanto você recebe de comissão."
        }
        actions={isManager ? <NewGoalButton owners={owners} /> : undefined}
      />

      <div className="mb-6">
        <LinkTabs
          label="Situação das metas"
          tabs={GOAL_TABS.map((key) => ({ href: key === "ativas" ? "/metas" : `/metas?aba=${key}`, label: GOAL_TAB_LABELS[key], active: key === tab }))}
        />
      </div>

      {goals.length === 0 ? (
        <GoalsEmpty
          title={tab === "ativas" ? "Nenhuma meta em andamento." : "Nenhuma meta encerrada."}
          hint={isManager ? "Crie uma meta e escolha o responsável." : "Quando a diretoria criar uma meta para você, ela aparece aqui."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} showOwner={isManager} />
          ))}
        </div>
      )}
    </>
  );
}
