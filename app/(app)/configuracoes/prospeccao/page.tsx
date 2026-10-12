import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { CadencesPanel } from "@/features/prospeccao/components/cadences-panel";
import { GeneralSettingsForm } from "@/features/prospeccao/components/general-settings-form";
import { GoalsPanel } from "@/features/prospeccao/components/goals-panel";
import { HolidaysPanel } from "@/features/prospeccao/components/holidays-panel";
import { ObjectionsPanel } from "@/features/prospeccao/components/objections-panel";
import { PlaybooksPanel } from "@/features/prospeccao/components/playbooks-panel";
import { ScriptsPanel } from "@/features/prospeccao/components/scripts-panel";
import { PROSPECTING_PATH, PROSPECTING_TABS, type ProspectingTab } from "@/features/prospeccao/labels";
import { getProspectingConfig } from "@/features/prospeccao/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { todayInAppZone } from "@/lib/calendar";

export const metadata: Metadata = { title: "Prospecção · Configurações" };

type SearchParams = Promise<{ aba?: string; grupo?: string }>;

export default async function ProspectingSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  // O middleware já barra a rota; aqui fica a segunda trava (só o master).
  if (!hasCapability(profile, "manageProspecting")) notFound();
  const params = await searchParams;
  const tab: ProspectingTab = PROSPECTING_TABS.find((item) => item.id === params.aba)?.id ?? "geral";
  const config = await getProspectingConfig();
  const now = new Date();

  const cadenceUsage: Record<string, string[]> = {};
  for (const playbook of config.playbooks.filter((item) => item.active)) {
    (cadenceUsage[playbook.cadence_type] ??= []).push(playbook.name);
  }

  return (
    <>
      <PageHeader
        panel="/configuracoes"
        eyebrow="Configurações"
        title="Prospecção."
        description="Playbooks, scripts, cadências e respostas da prospecção por WhatsApp. Alterar um texto vale para os próximos envios."
        actions={
          <Button asChild variant="ghost" size="lg">
            <Link href="/configuracoes">
              <ChevronLeft aria-hidden />
              Configurações
            </Link>
          </Button>
        }
      />

      <div className="grid min-w-0 max-w-5xl gap-6">
        <LinkTabs
          label="Seções da prospecção"
          tone="neutral"
          tabs={PROSPECTING_TABS.map((item) => ({ href: `${PROSPECTING_PATH}?aba=${item.id}`, label: item.label, active: item.id === tab }))}
        />
        {tab === "geral" ? <GeneralSettingsForm initial={config.general} /> : null}
        {tab === "playbooks" ? <PlaybooksPanel playbooks={config.playbooks} /> : null}
        {tab === "scripts" ? <ScriptsPanel config={config} group={params.grupo} nowIso={now.toISOString()} /> : null}
        {tab === "cadencias" ? <CadencesPanel cadences={config.cadences} usage={cadenceUsage} /> : null}
        {tab === "objecoes" ? <ObjectionsPanel objections={config.objections} /> : null}
        {tab === "feriados" ? <HolidaysPanel holidays={config.holidays} today={todayInAppZone(now)} /> : null}
        {tab === "metas" ? <GoalsPanel playbooks={config.playbooks} goals={config.goals} /> : null}
      </div>
    </>
  );
}
