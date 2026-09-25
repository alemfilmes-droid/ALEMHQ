import { formatDate } from "@/lib/format";
import type { Project } from "@/types";

type DatesProject = Pick<Project, "model" | "due_date" | "start_date" | "end_date">;

/** Rótulo curto para listas: data de entrega (transacional) ou período (recorrente). */
export function projectDatesLabel(project: DatesProject): string {
  if (project.model === "recorrente") {
    if (!project.start_date) return "Sem data";
    return project.end_date
      ? `${formatDate(project.start_date)} – ${formatDate(project.end_date)}`
      : `Em andamento desde ${formatDate(project.start_date)}`;
  }
  return project.due_date ? formatDate(project.due_date) : "Sem data";
}

export function ProjectDates({ project }: { project: DatesProject }) {
  return <>{projectDatesLabel(project)}</>;
}
