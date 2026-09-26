"use client";

import { FilterPopover, UrlSearchInput } from "@/components/filters/filter-popover";

interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface FiltersPopoverProps {
  groups: FilterGroup[];
  search?: { key: string; label: string };
}

/** Filtros do financeiro: o FilterPopover compartilhado + busca por texto, tudo na URL. */
export function FiltersPopover({ groups, search }: FiltersPopoverProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {search ? <UrlSearchInput paramKey={search.key} label={search.label} className="sm:w-72" /> : null}
      <FilterPopover sections={groups} />
    </div>
  );
}
