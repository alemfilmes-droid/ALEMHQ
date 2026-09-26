"use client";

import { CalendarClock, Megaphone, Pin } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardIcon } from "@/components/ui/card";
import { plainText } from "@/components/ui/rich-text";
import { SquadBadge } from "@/components/ui/squad-badge";
import { announcementPhase, type AnnouncementItem } from "@/features/announcements/types";
import { ORG_LEVEL_LABELS } from "@/lib/auth/org";
import { formatDateTime } from "@/lib/format";
import { SURFACE } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface AnnouncementCardProps {
  item: AnnouncementItem;
  onOpen: () => void;
}

/** Card de aviso: título, trecho, autor, data e público. Fixados primeiro; não lidos com o ponto do acento. */
export function AnnouncementCard({ item, onOpen }: AnnouncementCardProps) {
  const phase = announcementPhase(item);
  const excerpt = plainText(item.body);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(SURFACE.card, "group flex w-full flex-col gap-4 rounded-lg p-5 text-left outline-none")}
    >
      <div className="flex w-full items-start gap-3">
        <CardIcon icon={item.is_pinned ? Pin : Megaphone} tone="alert" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-2">
            {!item.is_read && phase === "ativos" ? (
              <span aria-label="Não lido" className="size-2 shrink-0 rounded-full bg-brand-accent" />
            ) : null}
            <span className="line-clamp-2 font-bold leading-snug group-hover:underline">{item.title}</span>
          </p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt}</p>
        </div>
        {item.is_pinned ? (
          <Badge variant="outline" className="shrink-0">
            Fixado
          </Badge>
        ) : null}
      </div>

      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[12px] text-subtle">
        <span className="flex min-w-0 items-center gap-2">
          <UserAvatar name={item.author_name ?? "—"} src={item.author_avatar_url} profileId={item.author_id} className="size-6" />
          <span className="truncate font-semibold text-muted-foreground">{item.author_name ?? "Diretoria"}</span>
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          {phase === "programados" ? <CalendarClock className="size-3.5" aria-hidden /> : null}
          {phase === "programados" ? "Publica em " : ""}
          {formatDateTime(item.published_at)}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {item.audience_squads.length === 0 ? <Badge variant="muted">Todos os squads</Badge> : item.audience_squads.map((squad) => <SquadBadge key={squad} squad={squad} />)}
          {item.audience_levels.map((level) => (
            <Badge key={level} variant="outline">
              {ORG_LEVEL_LABELS[level]}
            </Badge>
          ))}
        </span>
      </div>
    </button>
  );
}
