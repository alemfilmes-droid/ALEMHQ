"use client";

import { FilterPopover } from "@/components/filters/filter-popover";
import { INTERACTION_KINDS, INTERACTION_KIND_LABELS } from "@/features/crm/labels";
import type { DealOptionMember } from "@/features/crm/types";

/** Filtro do feed de atividades: responsável do negócio e tipo de atividade. */
export function ActivitiesFiltersPopover({ members }: { members: DealOptionMember[] }) {
  return (
    <FilterPopover
      sections={[
        { key: "responsavel", label: "SDR responsável", options: members.map((member) => ({ value: member.id, label: member.full_name })) },
        { key: "tipo", label: "Tipo", options: INTERACTION_KINDS.map((kind) => ({ value: kind, label: INTERACTION_KIND_LABELS[kind] })) },
      ]}
    />
  );
}
