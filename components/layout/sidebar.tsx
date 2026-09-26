"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { NavList } from "@/components/layout/nav-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/navigation";

interface SidebarProps {
  groups: NavGroup[];
  badges: Record<string, number>;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ groups, badges, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("pb-8 pt-12", collapsed ? "px-3" : "px-6")}>
        <BrandLogo collapsed={collapsed} />
      </div>
      <NavList groups={groups} badges={badges} collapsed={collapsed} />
      <div className={cn("border-t border-border p-3", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-expanded={!collapsed}
          className={cn(!collapsed && "w-full justify-start gap-3 px-3")}
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          {collapsed ? null : "Recolher"}
        </Button>
      </div>
    </aside>
  );
}
