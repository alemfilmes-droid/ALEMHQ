"use client";

import { useEffect, useState } from "react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SquadDirectoryProvider, type SquadDirectory } from "@/components/providers/squad-directory";
import type { NotificationsSnapshot } from "@/features/notifications/queries";
import { canAccessRouteFor } from "@/lib/auth/permissions";
import { getNavGroupsForProfile } from "@/lib/navigation";
import type { ProfileWithSquads } from "@/types";

const COLLAPSE_KEY = "alem-hq:sidebar-collapsed";

interface AppShellProps {
  profile: ProfileWithSquads;
  notifications: NotificationsSnapshot;
  squadDirectory: SquadDirectory;
  /** Contadores ao lado de itens da navegação (ex.: avisos não lidos). */
  badges?: Record<string, number>;
  children: React.ReactNode;
}

export function AppShell({ profile, notifications, squadDirectory, badges = {}, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = getNavGroupsForProfile(profile);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Armazenamento indisponível: mantém o padrão.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Ignora.
      }
      return next;
    });
  }

  return (
    <SquadDirectoryProvider directory={squadDirectory}>
      <div className="flex min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Ir para o conteúdo
        </a>
        <div className="print:hidden">
          <Sidebar groups={groups} badges={badges} collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
        <MobileDrawer groups={groups} badges={badges} open={drawerOpen} onOpenChange={setDrawerOpen} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="print:hidden">
            <Topbar
              profile={profile}
              notifications={notifications}
              canSeeSettings={canAccessRouteFor(profile, "/configuracoes")}
              onOpenMenu={() => setDrawerOpen(true)}
            />
          </div>
          <main id="conteudo" className="flex-1 px-4 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SquadDirectoryProvider>
  );
}
