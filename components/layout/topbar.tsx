"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Search } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "@/features/notifications/components/notifications-bell";
import type { NotificationsSnapshot } from "@/features/notifications/queries";
import { getPageTitle } from "@/lib/navigation";
import type { Profile } from "@/types";

interface TopbarProps {
  profile: Profile;
  notifications: NotificationsSnapshot;
  canSeeSettings: boolean;
  onOpenMenu: () => void;
}

export function Topbar({ profile, notifications, canSeeSettings, onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu aria-hidden />
      </Button>

      <nav aria-label="Trilha de navegação" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        <Link href="/inicio" className="font-semibold text-muted-foreground hover:text-foreground">
          Além HQ
        </Link>
        {title ? (
          <>
            <ChevronRight className="size-4 text-subtle" aria-hidden />
            <span className="truncate font-bold" aria-current="page">
              {title}
            </span>
          </>
        ) : null}
      </nav>

      <div className="relative ml-auto w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input type="search" aria-label="Busca global" placeholder="Buscar projetos, clientes, pessoas" className="pl-9" />
      </div>

      <NotificationsBell initial={notifications} />
      <UserMenu profile={profile} canSeeSettings={canSeeSettings} />
    </header>
  );
}
