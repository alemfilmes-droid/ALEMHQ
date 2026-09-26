"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnouncementCard } from "@/features/announcements/components/announcement-card";
import { AnnouncementFormDialog } from "@/features/announcements/components/announcement-form-dialog";
import { AnnouncementReader } from "@/features/announcements/components/announcement-reader";
import type { AnnouncementItem, AnnouncementTab } from "@/features/announcements/types";

interface AnnouncementsBoardProps {
  items: AnnouncementItem[];
  tab: AnnouncementTab;
  canManage: boolean;
  /** ?aviso= da URL (link da notificação). */
  initialOpenId?: string;
}

const EMPTY: Record<AnnouncementTab, string> = {
  ativos: "Nenhum aviso no ar agora.",
  programados: "Nenhum aviso programado.",
  encerrados: "Nenhum aviso encerrado.",
};

export function AnnouncementsBoard({ items, tab, canManage, initialOpenId }: AnnouncementsBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [editing, setEditing] = useState<AnnouncementItem | "new" | null>(null);
  const open = openId ? items.find((item) => item.id === openId) : undefined;

  function close() {
    setOpenId(null);
    if (searchParams.get("aviso")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("aviso");
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
  }

  return (
    <>
      {canManage ? (
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            Novo aviso
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
          <Megaphone className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="font-bold">{EMPTY[tab]}</p>
          <p className="mt-1 text-sm text-muted-foreground">Os comunicados da diretoria aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
          ))}
        </div>
      )}

      {open ? (
        <AnnouncementReader
          item={open}
          canManage={canManage}
          onOpenChange={(next) => !next && close()}
          onEdit={() => {
            setEditing(open);
            close();
          }}
        />
      ) : null}

      {editing ? <AnnouncementFormDialog item={editing === "new" ? undefined : editing} onOpenChange={(next) => !next && setEditing(null)} /> : null}
    </>
  );
}
