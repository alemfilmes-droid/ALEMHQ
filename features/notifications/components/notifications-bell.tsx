"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  refreshNotificationsAction,
} from "@/features/notifications/actions";
import type { NotificationsSnapshot } from "@/features/notifications/queries";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

/** Sino da topbar: contagem não lida (neutra), lista das 10 mais recentes, marcar todas como lidas. */
export function NotificationsBell({ initial }: { initial: NotificationsSnapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) startTransition(async () => setSnapshot(await refreshNotificationsAction()));
  }

  function handleItemClick(item: Notification) {
    setOpen(false);
    if (!item.read_at) {
      setSnapshot((current) => ({
        items: current.items.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)),
        unreadCount: Math.max(0, current.unreadCount - 1),
      }));
      void markNotificationReadAction(item.id);
    }
    if (item.url) router.push(item.url);
  }

  function handleMarkAll() {
    setSnapshot((current) => ({
      items: current.items.map((row) => ({ ...row, read_at: row.read_at ?? new Date().toISOString() })),
      unreadCount: 0,
    }));
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${snapshot.unreadCount > 0 ? `, ${snapshot.unreadCount} não lidas` : ""}`} className="relative">
          <Bell aria-hidden />
          {snapshot.unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background"
            >
              {snapshot.unreadCount > 9 ? "9+" : snapshot.unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-bold">Notificações</p>
          {snapshot.unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
        {snapshot.items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">Sem notificações por aqui.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {snapshot.items.map((item) => (
              <li key={item.id}>
                {item.url ? (
                  <Link
                    href={item.url}
                    onClick={(event) => {
                      event.preventDefault();
                      handleItemClick(item);
                    }}
                    className={cn(
                      "flex items-start gap-2.5 border-b border-border px-3 py-3 transition-colors hover:bg-surface-hover",
                      !item.read_at && "bg-surface-raised",
                    )}
                  >
                    <NotificationRow item={item} />
                  </Link>
                ) : (
                  <button type="button" onClick={() => handleItemClick(item)} className="flex w-full items-start gap-2.5 border-b border-border px-3 py-3 text-left transition-colors hover:bg-surface-hover">
                    <NotificationRow item={item} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({ item }: { item: Notification }) {
  return (
    <>
      <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-foreground")} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{item.title}</span>
        {item.body ? <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{item.body}</span> : null}
        <span className="mt-1 block text-[11px] text-subtle">{formatRelativeTime(item.created_at)}</span>
      </span>
    </>
  );
}
