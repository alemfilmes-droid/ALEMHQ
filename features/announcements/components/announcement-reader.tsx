"use client";

import { useEffect, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichText } from "@/components/ui/rich-text";
import { SquadBadge } from "@/components/ui/squad-badge";
import { markAnnouncementReadAction, setAnnouncementArchivedAction } from "@/features/announcements/actions";
import type { AnnouncementItem } from "@/features/announcements/types";
import { ORG_LEVEL_LABELS } from "@/lib/auth/org";
import { formatDateTime } from "@/lib/format";

interface AnnouncementReaderProps {
  item: AnnouncementItem;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

/** Texto completo do aviso. Abrir marca como lido (badge da sidebar e notificação somem). */
export function AnnouncementReader({ item, canManage, onOpenChange, onEdit }: AnnouncementReaderProps) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!item.is_read) void markAnnouncementReadAction(item.id);
  }, [item.id, item.is_read]);

  function toggleArchive() {
    startTransition(async () => {
      const result = await setAnnouncementArchivedAction(item.id, !item.archived_at);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-6">
          <p className="eyebrow">Aviso{item.is_pinned ? " · fixado" : ""}</p>
          <DialogTitle className="text-3xl">{item.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <UserAvatar name={item.author_name ?? "—"} src={item.author_avatar_url} profileId={item.author_id} className="size-6" />
              <span className="font-semibold text-foreground">{item.author_name ?? "Diretoria"}</span>
              <span className="text-subtle">· {formatDateTime(item.published_at)}</span>
              {item.expires_at ? <span className="text-subtle">· até {formatDateTime(item.expires_at)}</span> : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {item.audience_squads.length === 0 ? <Badge variant="muted">Todos os squads</Badge> : item.audience_squads.map((squad) => <SquadBadge key={squad} squad={squad} />)}
          {item.audience_levels.map((level) => (
            <Badge key={level} variant="outline">
              {ORG_LEVEL_LABELS[level]}
            </Badge>
          ))}
        </div>

        <div className="border-t border-border pt-5">
          <RichText source={item.body} className="text-[15px]" />
        </div>

        {canManage ? (
          <DialogFooter>
            <Button variant="ghost" onClick={toggleArchive} loading={pending}>
              {item.archived_at ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {item.archived_at ? "Reativar" : "Encerrar"}
            </Button>
            <Button variant="secondary" onClick={onEdit}>
              <Pencil aria-hidden />
              Editar
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
