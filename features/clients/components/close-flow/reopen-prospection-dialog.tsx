"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { PROSPECTION_GOALS, PROSPECTION_GOAL_LABELS } from "@/features/crm/labels";
import { useLifecycleSubmit } from "@/features/clients/components/close-flow/use-lifecycle-submit";
import { prospectionOptionsAction, reopenProspectionAction } from "@/features/clients/lifecycle-actions";
import type { ProspectionGoal } from "@/types";

type Options = Awaited<ReturnType<typeof prospectionOptionsAction>>;

/** "Reabrir prospecção": negócio novo no CRM ligado ao cliente inativo, com playbook e SDR (padrão: o SDR da empresa). */
export function ReopenProspectionDialog({ companyId, companyName, onClose }: { companyId: string; companyName: string; onClose: () => void }) {
  const router = useRouter();
  const { pending, failure, submit } = useLifecycleSubmit(() => {
    onClose();
    router.push("/crm?aba=leads");
  });
  const [options, setOptions] = useState<Options | null>(null);
  const [playbookId, setPlaybookId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [goal, setGoal] = useState<ProspectionGoal | "">("");

  useEffect(() => {
    prospectionOptionsAction().then((data) => {
      setOptions(data);
      setOwnerId(data.defaultSdrId ?? "");
      setPlaybookId(data.playbooks[0]?.id ?? "");
    });
  }, []);

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Reabrir prospecção.</DialogTitle>
          <DialogDescription>{companyName}: um negócio novo entra no CRM, ligado ao cliente. O histórico continua.</DialogDescription>
        </DialogHeader>
        {!options ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            <FormField id="reopen-playbook" label="Playbook">
              <NativeSelect id="reopen-playbook" value={playbookId} onChange={(event) => setPlaybookId(event.target.value)}>
                {options.playbooks.map((playbook) => (
                  <option key={playbook.id} value={playbook.id}>
                    {playbook.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="reopen-owner" label="SDR">
              <NativeSelect id="reopen-owner" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                {options.sdrs.map((sdr) => (
                  <option key={sdr.id} value={sdr.id}>
                    {sdr.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="reopen-goal" label="Objetivo">
              <NativeSelect id="reopen-goal" value={goal} onChange={(event) => setGoal(event.target.value as ProspectionGoal)}>
                <option value="" disabled>
                  Escolha o objetivo
                </option>
                {PROSPECTION_GOALS.map((item) => (
                  <option key={item} value={item}>
                    {PROSPECTION_GOAL_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
        )}
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="lg"
            loading={pending}
            disabled={!playbookId || !ownerId || !goal}
            onClick={() => submit(() => reopenProspectionAction({ companyId, playbookId, ownerId, goal: goal as ProspectionGoal }))}
          >
            Reabrir prospecção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
