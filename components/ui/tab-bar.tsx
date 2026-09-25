"use client";

import { cn } from "@/lib/utils";

interface TabBarProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string }[];
}

/** Abas de estado local (dentro de um modal, por exemplo) — sem navegação, ao contrário de LinkTabs. */
export function TabBar<T extends string>({ label, value, onChange, tabs }: TabBarProps<T>) {
  return (
    <nav aria-label={label} className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          aria-current={tab.value === value ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
            tab.value === value
              ? "border-foreground font-bold text-foreground"
              : "border-transparent font-semibold text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
