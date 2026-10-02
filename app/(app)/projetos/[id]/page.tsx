import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { ProjectClientLabel } from "@/components/projects/project-client-label";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { ProjectMarginLine } from "@/components/projects/project-margin-line";
import { getCompanySettings } from "@/features/settings/queries";
import { ProjectOverviewEditor } from "@/components/projects/project-overview-editor";
import { StageSelect } from "@/components/projects/stage-select";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/link-tabs";
import { ProjectFinanceTab } from "@/features/finance/components/project-finance-tab";
import { getProjectProfitability } from "@/features/finance/queries";
import { KanbanBoard } from "@/features/pautas/components/kanban-board";
import { getPautaFormOptions, listPautas } from "@/features/pautas/queries";
import { canCreateProjectPauta, canDeleteProject, canFullyManagePauta, hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { MODEL_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { FinalizeProjectButton } from "@/features/projects/components/finalize-project-dialog";
import { InvoiceSchedulesCard } from "@/features/projects/components/invoice-schedules-card";
import { getInvoiceSchedules } from "@/features/projects/invoices";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Projeto" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ aba?: string; pauta?: string; finalizar?: string }>;

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { id } = await params;
  const { aba, pauta, finalizar } = await searchParams;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "*, company:companies(id, name, logo_url), contact:contacts(*), owner:profiles!projects_owner_id_fkey(id, full_name), members:project_members(profile_id, profile:profiles!project_members_profile_id_fkey(id, full_name, avatar_url))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const canSeeFinance = hasCapability(profile, "finance");
  const canManage = hasCapability(profile, "manageProjects");
  const tab = aba === "financeiro" ? "financeiro" : aba === "pautas" ? "pautas" : "geral";
  const tabs = [{ href: `/projetos/${id}`, label: "Visão geral", active: tab === "geral" }];
  tabs.push({ href: `/projetos/${id}?aba=pautas`, label: "Pautas", active: tab === "pautas" });
  if (canSeeFinance) tabs.push({ href: `/projetos/${id}?aba=financeiro`, label: "Financeiro", active: tab === "financeiro" });

  const [profitability, contactsResult, membersOptionsResult, pautasResult, pautaOptionsResult, canFinalizeResult, canInvoicesResult, invoiceSchedules] = await Promise.all([
    canSeeFinance && !project.is_internal ? getProjectProfitability(project.id) : Promise.resolve(null),
    project.company_id ? supabase.from("contacts").select("id, full_name").eq("company_id", project.company_id).order("full_name") : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name, avatar_url").eq("is_active", true).neq("full_name", "").order("full_name"),
    tab === "pautas" ? listPautas({ projectIds: [id] }) : Promise.resolve([]),
    tab === "pautas" ? getPautaFormOptions() : Promise.resolve(null),
    supabase.rpc("can_finalize_project", { p_project_id: id }),
    supabase.rpc("can_manage_invoices", { p_project_id: id }),
    tab === "geral" ? getInvoiceSchedules(id) : Promise.resolve([]),
  ]);
  const canManageInvoices = canInvoicesResult.data === true;
  const canFinalize = canFinalizeResult.data === true;

  const memberIds = project.members.map((m) => m.profile_id);
  const memberProfiles = project.members.map((m) => m.profile).filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <>
      <PageHeader
        panel="/projetos"
        leading={project.company && !project.is_internal ? <ClientAvatar name={project.company.name} logoUrl={project.company.logo_url} size="lg" /> : undefined}
        eyebrow="Projeto"
        title={project.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canDeleteProject(profile) ? <DeleteProjectDialog projectId={project.id} projectName={project.name} /> : null}
            {!project.finalized_at && !project.is_internal && canFinalize ? <FinalizeProjectButton projectId={project.id} autoOpen={finalizar === "1"} /> : null}
            <StageSelect projectId={project.id} stage={project.stage} disabled={!canManage} />
          </div>
        }
      />
      <div className="-mt-4 mb-8 space-y-1.5">
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <ProjectClientLabel isInternal={project.is_internal} company={project.company} asLink />
          {project.is_internal ? <Badge variant="muted">Interno</Badge> : null}
          <Badge variant="muted">{MODEL_LABELS[project.model]}</Badge>
          {project.finalized_at ? <Badge variant="outline">Finalizado em {formatDate(project.finalized_at.slice(0, 10))}</Badge> : null}
          <span>Código: {project.id.slice(0, 8)}</span>
        </p>
        {profitability ? <ProjectMarginLine marginPct={profitability.marginPct} marginStatus={profitability.marginStatus} target={(await getCompanySettings()).margin.healthy} /> : null}
      </div>

      <LinkTabs label="Seções do projeto" tabs={tabs} />

      <div className="mt-6">
        {tab === "financeiro" ? (
          <ProjectFinanceTab projectId={project.id} companyId={project.company_id} isInternal={project.is_internal} />
        ) : tab === "pautas" ? (
          pautaOptionsResult ? (
            <div className="h-[calc(100dvh-22rem)] min-h-[420px]">
              <KanbanBoard
                initialPautas={pautasResult}
                options={pautaOptionsResult}
                canManage={canFullyManagePauta(profile)}
                canCreate={canCreateProjectPauta(profile)}
                canCreateProjects={canManage}
                lockedProjectId={project.id}
                initialOpenId={pauta}
                currentUser={{ id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, squads: profile.squads }}
              />
            </div>
          ) : null
        ) : (
          <ProjectOverviewEditor
            projectId={id}
            canManage={canManage}
            isInternal={project.is_internal}
            model={project.model}
            contact={project.contact}
            contactOptions={contactsResult.data ?? []}
            priority={project.priority}
            serviceTypes={project.service_types}
            ownerId={project.owner_id}
            memberOptions={membersOptionsResult.data ?? []}
            memberIds={memberIds}
            memberProfiles={memberProfiles}
            startDate={project.start_date}
            dueDate={project.due_date}
            endDate={project.end_date}
            briefing={project.briefing}
            productionNotes={project.production_notes}
            locationAddress={project.location_address}
            locationNotes={project.location_notes}
            includedRevisionRounds={project.included_revision_rounds}
            driveFolderUrl={project.drive_folder_url}
            deliveryNotes={project.delivery_notes}
          />
        )}
        {tab === "geral" && !project.is_internal && (canManageInvoices || invoiceSchedules.length > 0) ? (
          <div className="mt-6 max-w-3xl">
            <InvoiceSchedulesCard
              projectId={project.id}
              schedules={invoiceSchedules}
              canManage={canManageInvoices}
              members={membersOptionsResult.data ?? []}
              contacts={contactsResult.data ?? []}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
