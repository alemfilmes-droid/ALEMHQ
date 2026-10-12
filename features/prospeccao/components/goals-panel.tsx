"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Target } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { useSave } from "@/features/prospeccao/components/use-save";
import { saveGoalMappingAction } from "@/features/prospeccao/settings-actions";
import type { GoalOption, PlaybookView } from "@/features/prospeccao/types";
import { formatDate } from "@/lib/format";

const NONE = "";

/** Aba Playbook → Meta: a meta que vem sugerida ao cadastrar um lead com esse playbook. */
export function GoalsPanel({ playbooks, goals }: { playbooks: PlaybookView[]; goals: GoalOption[] }) {
  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Ao cadastrar um lead, o campo Meta vinculada já vem com a meta do playbook. O SDR pode trocar ou marcar &quot;nenhuma&quot;. Como as metas
        mudam a cada trimestre, revise este mapeamento quando criar metas novas.
      </p>
      {goals.length === 0 ? (
        <Alert title="Nenhuma meta ativa">
          Crie as metas em{" "}
          <Link href="/metas" className="font-semibold text-foreground underline underline-offset-4">
            Metas
          </Link>{" "}
          e volte aqui para ligar cada playbook a uma delas.
        </Alert>
      ) : null}
      <Card variant="static">
        <CardHeading icon={Target} tone="slate" title="Meta sugerida por playbook" />
        <CardContent>
          <ul className="divide-y divide-border">
            {playbooks.map((playbook) => (
              <GoalRow key={playbook.id} playbook={playbook} goals={goals} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalRow({ playbook, goals }: { playbook: PlaybookView; goals: GoalOption[] }) {
  const [goalId, setGoalId] = useState(playbook.suggested_goal_id ?? NONE);
  const { pending, run } = useSave();
  const id = `meta-${playbook.id}`;
  const stale = goalId !== NONE && !goals.some((goal) => goal.id === goalId);
  const dirty = goalId !== (playbook.suggested_goal_id ?? NONE);

  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {playbook.name}
        {playbook.active ? null : <span className="font-normal text-muted-foreground"> · inativo</span>}
      </label>
      <NativeSelect id={id} className="h-11" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
        <option value={NONE}>Nenhuma</option>
        {stale ? <option value={goalId}>Meta encerrada ou fora da lista</option> : null}
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.title} · até {formatDate(goal.endsOn)}
          </option>
        ))}
      </NativeSelect>
      <Button
        type="button"
        size="lg"
        disabled={!dirty}
        loading={pending}
        onClick={() => run(() => saveGoalMappingAction({ playbookId: playbook.id, goalId: goalId || null }))}
      >
        <Save aria-hidden />
        Salvar
      </Button>
    </li>
  );
}
