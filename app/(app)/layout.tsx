import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSquadDirectory } from "@/features/team/queries";
import { getUnreadAnnouncementsCount, publishDueAnnouncements } from "@/features/announcements/queries";
import { getNotificationsSnapshot } from "@/features/notifications/queries";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // Avisos agendados cujo horário chegou: gera as notificações do público (idempotente no banco).
  await publishDueAnnouncements();

  const [notifications, squadDirectory, unreadAnnouncements] = await Promise.all([
    getNotificationsSnapshot(),
    getSquadDirectory(),
    getUnreadAnnouncementsCount(),
  ]);

  return (
    <AppShell profile={profile} notifications={notifications} squadDirectory={squadDirectory} badges={{ "/avisos": unreadAnnouncements }}>
      {children}
    </AppShell>
  );
}
