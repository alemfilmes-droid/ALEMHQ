import type { Announcement } from "@/types";

export const ANNOUNCEMENT_TABS = ["ativos", "programados", "encerrados"] as const;
export type AnnouncementTab = (typeof ANNOUNCEMENT_TABS)[number];

export const ANNOUNCEMENT_TAB_LABELS: Record<AnnouncementTab, string> = {
  ativos: "Ativos",
  programados: "Programados",
  encerrados: "Encerrados",
};

export interface AnnouncementItem extends Announcement {
  author_name: string | null;
  author_avatar_url: string | null;
  /** A pessoa já abriu este aviso. */
  is_read: boolean;
}

/** Em que aba o aviso está agora (a UI usa para rótulos; a lista vem filtrada do servidor). */
export function announcementPhase(item: Pick<Announcement, "published_at" | "expires_at" | "archived_at">, now = new Date()): AnnouncementTab {
  if (item.archived_at) return "encerrados";
  if (new Date(item.published_at) > now) return "programados";
  if (item.expires_at && new Date(item.expires_at) <= now) return "encerrados";
  return "ativos";
}
