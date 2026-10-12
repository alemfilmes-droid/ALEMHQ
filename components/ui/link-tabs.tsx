import Link from "next/link";
import { cn } from "@/lib/utils";

interface LinkTabsProps {
  label: string;
  tabs: { href: string; label: string; active: boolean }[];
  /** "neutral": sublinhado branco, para telas em que o vermelho da marca não pode marcar estado. */
  tone?: "brand" | "neutral";
}

/** Abas baseadas em URL (searchParams), renderizadas no servidor. */
export function LinkTabs({ label, tabs, tone = "brand" }: LinkTabsProps) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
            tone === "neutral" && "flex min-h-11 items-center",
            tab.active
              ? cn(tone === "brand" ? "border-brand-accent" : "border-foreground", "font-bold text-foreground")
              : "border-transparent font-semibold text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
