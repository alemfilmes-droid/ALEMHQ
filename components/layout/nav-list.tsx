"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/navigation";

interface NavListProps {
  groups: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavList({ groups, collapsed = false, onNavigate }: NavListProps) {
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
                        ? "bg-surface-hover font-bold text-foreground"
                        : "font-semibold text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                    )}
                  >
                    {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground" /> : null}
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className={cn(collapsed && "sr-only")}>{item.label}</span>
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
