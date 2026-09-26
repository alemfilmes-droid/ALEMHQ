import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkTabs } from "@/components/ui/link-tabs";
import { AnnouncementsBoard } from "@/features/announcements/components/announcements-board";
import { listAnnouncements } from "@/features/announcements/queries";
import { ANNOUNCEMENT_TABS, ANNOUNCEMENT_TAB_LABELS, type AnnouncementTab } from "@/features/announcements/types";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Avisos" };

type SearchParams = Promise<{ aba?: string; aviso?: string }>;

export default async function AnnouncementsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const canManage = hasCapability(profile, "manageCompany");
  // Programados e Encerrados são da diretoria; a RLS nem devolve essas linhas para os demais.
  const tab: AnnouncementTab = canManage ? (ANNOUNCEMENT_TABS.find((item) => item === params.aba) ?? "ativos") : "ativos";
  const items = await listAnnouncements(tab, profile.id);

  return (
    <>
      <PageHeader
        panel="/avisos"
        eyebrow="Empresa"
        title="Avisos."
        description="Comunicados da diretoria para a equipe. Os fixados aparecem primeiro."
      />

      {canManage ? (
        <div className="mb-6">
          <LinkTabs
            label="Situação dos avisos"
            tabs={ANNOUNCEMENT_TABS.map((key) => ({
              href: key === "ativos" ? "/avisos" : `/avisos?aba=${key}`,
              label: ANNOUNCEMENT_TAB_LABELS[key],
              active: key === tab,
            }))}
          />
        </div>
      ) : null}

      <Suspense>
        <AnnouncementsBoard key={tab} items={items} tab={tab} canManage={canManage} initialOpenId={params.aviso} />
      </Suspense>
    </>
  );
}
