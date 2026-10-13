"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadenceStatusTag } from "@/features/prospeccao/components/cadence-status-tag";
import { ManageProspectingMenu } from "@/features/prospeccao/components/manage/manage-prospecting-menu";
import { ProspectFieldsInputs } from "@/features/prospeccao/components/prospect-fields-inputs";
import { useSave } from "@/features/prospeccao/components/use-save";
import { saveProspectFieldsAction } from "@/features/prospeccao/lead-actions";
import type { ProspectFieldsValues } from "@/features/prospeccao/lead-schemas";
import { touchLabel } from "@/features/prospeccao/status";
import type { LeadProspect, ProspectFormOptions } from "@/features/prospeccao/types";
import { formatDate } from "@/lib/format";

function toValues(prospect: LeadProspect): ProspectFieldsValues {
  const f = prospect.fields;
  return {
    playbookId: f.prospect_playbook_id ?? "",
    leadType: f.prospect_lead_type ?? "escola",
    contactIsDecisionMaker: f.prospect_contact_is_decision_maker ?? true,
    decisionMakerName: f.prospect_decision_maker_name ?? "",
    decisionMakerRole: f.prospect_decision_maker_role ?? "",
    decisionMakerWhatsapp: f.prospect_decision_maker_whatsapp ?? "",
    hook: f.prospect_hook ?? "",
    goalId: f.prospect_goal_id,
    lastDeliveredProject: f.prospect_last_delivered_project ?? "",
  };
}

/** Prospecção no detalhe do negócio: status da cadência e os campos do lead. */
export function ProspectSection({
  dealId,
  prospect,
  options,
  canManage,
  onSaved,
}: {
  dealId: string;
  prospect: LeadProspect;
  options: ProspectFormOptions;
  /** CEO/admin ou Head comercial: menu "Gerenciar" (editar, reiniciar, remover, apagar). */
  canManage: boolean;
  onSaved: () => void;
}) {
  const removedAt = prospect.fields.prospect_removed_at;
  const inCadence = prospect.fields.prospect_playbook_id !== null && removedAt === null;
  const manage = canManage && prospect.fields.prospect_cadence_started_at !== null ? <ManageProspectingMenu dealId={dealId} /> : null;
  const [editing, setEditing] = useState(inCadence);
  const [values, setValues] = useState(() => toValues(prospect));
  const { pending, run } = useSave();
  const cadence = prospect.cadence;
  const touch = cadence ? touchLabel(cadence.state) : null;

  if (removedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Removido da prospecção em {formatDate(removedAt)}. {canManage ? "Para voltar, use Gerenciar → Reiniciar cadência." : "Só a gestão do comercial traz de volta."}
        </p>
        {manage}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Este negócio está fora da cadência de prospecção.</p>
        {manage}
        <Button type="button" variant="secondary" size="lg" onClick={() => setEditing(true)} disabled={options.playbooks.length === 0}>
          <Plus aria-hidden />
          Colocar na prospecção
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {manage ? <div className="flex justify-end">{manage}</div> : null}
      {cadence ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <CadenceStatusTag status={cadence.state.status} />
          <span className="text-muted-foreground">{cadence.playbookName}</span>
          {touch ? <span className="font-semibold text-foreground">· {touch}</span> : null}
          {cadence.state.nextDueDate ? <span className="text-muted-foreground">· {formatDate(cadence.state.nextDueDate)}</span> : null}
        </p>
      ) : null}
      {prospect.fields.prospect_paused_at ? <p className="text-[13px] text-muted-foreground">Pausado: {prospect.fields.prospect_pause_reason}</p> : null}
      {prospect.fields.prospect_discarded_at ? <p className="text-[13px] text-muted-foreground">Descartado: {prospect.fields.prospect_discard_reason}</p> : null}
      <ProspectFieldsInputs idPrefix={`prospeccao-${dealId}`} values={values} onChange={setValues} options={options} full />
      <div className="flex justify-end">
        <Button type="button" size="lg" loading={pending} disabled={!values.playbookId} onClick={() => run(() => saveProspectFieldsAction(dealId, values), onSaved)}>
          <Save aria-hidden />
          Salvar prospecção
        </Button>
      </div>
    </div>
  );
}
