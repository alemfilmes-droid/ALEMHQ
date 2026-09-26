"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/navigation";

interface NavListProps {
  groups: NavGroup[];
  badges?: Record<string, number>;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavList({ groups, badges = {}, collapsed = false, onNavigate }: NavListProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {groups.map((group) => (
        <div key={group.label}>
          <p className={cn("eyebrow mb-2 px-3", collapsed && "sr-only")}>{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const badge = badges[item.href] ?? 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-surface-hover font-bold text-foreground shadow-[inset_0_0_0_1px_var(--accent-soft)]"
                        : "font-semibold text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                    )}
                  >
                    {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-accent" /> : null}
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                    {badge > 0 ? (
                      <span
                        className={cn(
                          "flex min-w-[18px] items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-1 text-[10px] font-bold tabular-nums text-foreground",
                          collapsed ? "absolute right-2 top-1.5 h-4 min-w-4" : "ml-auto h-[18px]",
                        )}
                        aria-label={`${badge} não ${badge === 1 ? "lido" : "lidos"}`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
