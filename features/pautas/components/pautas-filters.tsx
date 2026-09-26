"use client";

import { FilterPopover, UrlSearchInput, type FilterSection } from "@/components/filters/filter-popover";
import type { PautaFormOptions } from "@/features/pautas/types";
import { SQUADS, SQUAD_LABELS } from "@/lib/auth/squads";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import { PAUTA_STATUSES, PAUTA_STATUS_LABELS } from "@/lib/pautas";
import { PAUTA_STATUS_TONE, SQUAD_TONE } from "@/lib/status";

interface PautasFiltersProps {
  options: PautaFormOptions;
  companies: { id: string; name: string }[];
}

/**
 * Filtros de /pautas — tudo na URL (?prioridade=media&squad=audiovisual…). A página lê os mesmos
 * parâmetros com parsePautaFilters() e filtra no servidor (a RLS continua valendo por baixo).
 */
export function PautasFilters({ options, companies }: PautasFiltersProps) {
  const people = options.members.map((member) => ({ value: member.id, label: member.full_name }));
  const sections: FilterSection[] = [
    { key: "prioridade", label: "Prioridade", options: PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABELS[item] })) },
    {
      key: "status",
      label: "Status",
      options: PAUTA_STATUSES.map((item) => ({ value: item, label: PAUTA_STATUS_LABELS[item], tone: PAUTA_STATUS_TONE[item] })),
    },
    { key: "squad", label: "Squad", options: SQUADS.map((item) => ({ value: item, label: SQUAD_LABELS[item], tone: SQUAD_TONE[item] })) },
    { key: "lider", label: "Líder", options: people },
    { key: "responsavel", label: "Responsável", options: people },
    { key: "cliente", label: "Cliente", options: companies.map((company) => ({ value: company.id, label: company.name })) },
    { key: "projeto", label: "Projeto", options: options.projects.map((project) => ({ value: project.id, label: project.name })) },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <UrlSearchInput label="Buscar pauta" />
      <FilterPopover sections={sections} />
    </div>
  );
}
