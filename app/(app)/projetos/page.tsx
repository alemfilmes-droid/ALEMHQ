import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectBoardView } from "@/components/projects/project-board-view";
import { ProjectClientLabel } from "@/components/projects/project-client-label";
import { ProjectDates } from "@/components/projects/project-dates";
import { ProjectFilters } from "@/components/projects/project-filters";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { getCompanySettings } from "@/features/settings/queries";
import { hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { ALL_PROJECT_STAGES, MODEL_LABELS, MODELS, STAGE_LABELS } from "@/lib/domain";
import { PROJECT_STAGE_TONE } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { ProjectModel, ProjectStage } from "@/types";

export const metadata: Metadata = { title: "Projetos" };

type SearchParams = Promise<{
  modelo?: string;
  cliente?: string;
  etapa?: string;
  busca?: string;
  meus?: string;
  visao?: string;
}>;

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const canManage = hasCapability(profile, "manageProjects");
  const model = MODELS.find((item): item is ProjectModel => item === params.modelo);
  const stage = ALL_PROJECT_STAGES.find((item): item is ProjectStage => item === params.etapa);
  const onlyMine = params.meus === "1";
  const boardView = params.visao === "quadro";

  const supabase = await createClient();

  let memberProjectIds: string[] | null = null;
  if (onlyMine) {
    const { data } = await supabase.from("project_members").select("project_id").eq("profile_id", profile.id);
    memberProjectIds = (data ?? []).map((row) => row.project_id);
  }

  let query = supabase
    .from("projects")
    .select("id, name, stage, model, due_date, start_date, end_date, is_internal, owner_id, company:companies(id, name, logo_url)")
    .order("created_at", { ascending: false });
  if (model) query = query.eq("model", model);
  if (params.cliente) query = query.eq("company_id", params.cliente);
  if (stage) query = query.eq("stage", stage);
  if (params.busca?.trim()) query = query.ilike("name", `%${params.busca.trim()}%`);
  if (onlyMine) {
    const ids = Array.from(new Set([...(memberProjectIds ?? [])]));
    // owner_id=eu OU membro=eu. Sem ids de membro, cai só no owner via .or.
    query = query.or(`owner_id.eq.${profile.id}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`);
  }

  const [projectsResult, companiesResult, contactsResult, membersResult] = await Promise.all([
    query,
    supabase.from("companies").select("id, name").order("name"),
    canManage ? supabase.from("contacts").select("id, company_id, full_name").order("full_name") : Promise.resolve({ data: [] }),
    canManage
      ? supabase.from("profiles").select("id, full_name, avatar_url").eq("is_active", true).neq("full_name", "").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);
  const projects = projectsResult.data ?? [];
  const hasFilters = Boolean(model || params.cliente || stage || params.busca || onlyMine);

  return (
    <>
      <PageHeader
        panel="/projetos"
        eyebrow="Operação"
        title="Projetos."
        description="Produções de clientes e projetos internos da Além Filmes."
        actions={
          canManage ? (
            <NewProjectDialog
              companies={companiesResult.data ?? []}
              contacts={contactsResult.data ?? []}
              members={membersResult.data ?? []}
              showFinance={hasCapability(profile, "finance")}
              defaultOwnerId={profile.id}
              marginThresholds={(await getCompanySettings()).margin}
            />
          ) : null
        }
      />

      <div className="space-y-4">
        <Suspense>
          <ProjectFilters companies={companiesResult.data ?? []} />
        </Suspense>

        {projectsResult.error ? (
          <div role="alert" className="flex items-center gap-3 rounded-lg border-2 border-foreground p-4 text-sm font-semibold">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            Não foi possível carregar os projetos. Recarregue a página.
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
            <FolderKanban className="mb-3 size-6 text-muted-foreground" aria-hidden />
            <p className="font-bold">{hasFilters ? "Nenhum projeto com esses filtros." : "Nenhum projeto por aqui."}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters ? "Ajuste ou limpe os filtros." : canManage ? "Use “Novo projeto” para começar." : "Você ainda não foi adicionado a projetos."}
            </p>
          </div>
        ) : boardView ? (
          <ProjectBoardView projects={projects} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {projects.map((project) => (
              <li key={project.id}>
                <Link href={`/projetos/${project.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-raised">
                  <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                    <StatusDot tone={PROJECT_STAGE_TONE[project.stage]} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{project.name}</p>
                      <p className="flex min-w-0 text-[13px] text-muted-foreground">
                        <ProjectClientLabel isInternal={project.is_internal} company={project.company} withAvatar className="mt-0.5 max-w-full" />
                      </p>
                    </div>
                  </div>
                  {project.is_internal ? <Badge variant="muted">Interno</Badge> : null}
                  <Badge variant="muted">{MODEL_LABELS[project.model]}</Badge>
                  <Badge variant="outline">{STAGE_LABELS[project.stage]}</Badge>
                  <span className="w-32 text-right text-[13px] text-muted-foreground">
                    <ProjectDates project={project} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
