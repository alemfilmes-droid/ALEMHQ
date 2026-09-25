import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getNotificationsSnapshot } from "@/features/notifications/queries";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const notifications = await getNotificationsSnapshot();

  return (
    <AppShell profile={profile} notifications={notifications}>
      {children}
    </AppShell>
  );
}
