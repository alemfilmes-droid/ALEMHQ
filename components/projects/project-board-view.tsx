import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusBar } from "@/components/ui/status-bar";
import { StatusDot } from "@/components/ui/status-dot";
import { ProjectClientLabel } from "@/components/projects/project-client-label";
import { ProjectDates } from "@/components/projects/project-dates";
import { ALL_PROJECT_STAGES, MODEL_LABELS, STAGE_LABELS } from "@/lib/domain";
import { PROJECT_STAGE_TONE } from "@/lib/status";
import type { Project } from "@/types";

type BoardProject = Pick<Project, "id" | "name" | "stage" | "model" | "due_date" | "start_date" | "end_date" | "is_internal"> & {
  company: { id: string; name: string; logo_url: string | null } | null;
};

/**
 * Quadro somente leitura, agrupado por etapa — sem arrastar (a etapa muda pela Visão geral do
 * projeto). O quadro que arrasta de verdade é o de Pautas.
 */
export function ProjectBoardView({ projects }: { projects: BoardProject[] }) {
  const stagesWithCards = ALL_PROJECT_STAGES.filter((stage) => projects.some((project) => project.stage === stage));

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stagesWithCards.map((stage) => {
        const items = projects.filter((project) => project.stage === stage);
        return (
          <div key={stage} className="w-72 shrink-0 rounded-lg border border-border bg-surface">
            <div className="relative border-b border-border px-3 py-3">
              <StatusBar tone={PROJECT_STAGE_TONE[stage]} side="top" />
              <span className="flex items-center gap-2">
                <StatusDot tone={PROJECT_STAGE_TONE[stage]} />
                <span className="text-sm font-bold">{STAGE_LABELS[stage]}</span>
                <span className="text-xs font-semibold text-subtle">{items.length}</span>
              </span>
            </div>
            <ul className="space-y-2 p-2.5">
              {items.map((project) => (
                <li key={project.id}>
                  <Link href={`/projetos/${project.id}`} className="block rounded-md border border-border bg-card p-3 transition-colors hover:border-border-strong">
                    <p className="text-sm font-bold leading-snug">{project.name}</p>
                    <p className="mt-1.5 flex min-w-0 text-[12px] text-muted-foreground">
                      <ProjectClientLabel isInternal={project.is_internal} company={project.company} withAvatar className="max-w-full" />
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="muted">{MODEL_LABELS[project.model]}</Badge>
                      <span className="text-[12px] text-muted-foreground">
                        <ProjectDates project={project} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
