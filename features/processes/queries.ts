import "server-only";
import type { ProcessDetail, ProcessRunItem, ProcessStepItem, ProcessSummary, StepTool } from "@/features/processes/types";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types";

type StepRow = Tables["process_steps"]["Row"];

function toStep(row: StepRow): ProcessStepItem {
  return {
    id: row.id,
    orderIndex: row.order_index,
    title: row.title,
    description: row.description,
    responsibleRole: row.responsible_role,
    systemArea: row.system_area,
    systemLink: row.system_link,
    doneCriteria: row.done_criteria,
    estimatedMinutes: row.estimated_minutes,
    isBlocking: row.is_blocking,
    tool: row.tool === "pasta_drive" ? (row.tool satisfies StepTool) : null,
    archived: row.archived_at !== null,
  };
}

/**
 * Processos visíveis para a pessoa (a RLS já restringe aos squads dela; quem edita também vê
 * rascunhos e arquivados). Inclui o texto dos passos para a busca.
 */
export async function listProcesses(): Promise<ProcessSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processes")
    .select("*, steps:process_steps(title, description, archived_at)")
    .order("squad")
    .order("order_index")
    .order("title");
  if (error) throw new Error("Falha ao carregar os fluxogramas.");
  return (data ?? []).map(({ steps, ...row }) => {
    const active = steps.filter((step) => step.archived_at === null);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      squad: row.squad,
      summary: row.summary,
      triggerDescription: row.trigger_description,
      frequency: row.frequency,
      ownerRole: row.owner_role,
      orderIndex: row.order_index,
      isPublished: row.is_published,
      archived: row.archived_at !== null,
      stepCount: active.length,
      searchText: [row.title, row.summary, row.trigger_description, row.owner_role, ...active.flatMap((step) => [step.title, step.description])]
        .filter(Boolean)
        .join(" "),
    };
  });
}

export async function getProcess(slug: string): Promise<ProcessDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processes")
    .select("*, steps:process_steps(*), editor:profiles!processes_updated_by_fkey(full_name)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Falha ao carregar o fluxograma.");
  if (!data) return null;
  const { steps, editor, ...row } = data;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    squad: row.squad,
    summary: row.summary,
    triggerDescription: row.trigger_description,
    frequency: row.frequency,
    ownerRole: row.owner_role,
    orderIndex: row.order_index,
    isPublished: row.is_published,
    archived: row.archived_at !== null,
    updatedAt: row.updated_at,
    updatedByName: editor?.full_name ?? null,
    steps: [...steps].sort((a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at)).map(toStep),
  };
}

/**
 * Execuções do processo que a pessoa pode ver (as dela; a liderança do squad vê as de todos), mais
 * recentes primeiro. A execução aberta da própria pessoa vem em `open`.
 */
export async function listProcessRuns(processId: string, profileId: string): Promise<{ open: ProcessRunItem | null; finished: ProcessRunItem[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("process_runs")
    .select(
      "id, started_at, finished_at, started_by, context_label, context_entity_type, context_entity_id, starter:profiles!process_runs_started_by_fkey(full_name), steps:process_run_steps(step_id, done_at, doer:profiles!process_run_steps_done_by_fkey(full_name))",
    )
    .eq("process_id", processId)
    .order("started_at", { ascending: false })
    .limit(60);
  if (error) return { open: null, finished: [] };
  const runs: ProcessRunItem[] = (data ?? []).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    startedById: row.started_by,
    startedByName: row.starter?.full_name ?? "—",
    contextLabel: row.context_label,
    contextEntityType: row.context_entity_type,
    contextEntityId: row.context_entity_id,
    done: row.steps.map((step) => ({ stepId: step.step_id, doneAt: step.done_at, doneByName: step.doer?.full_name ?? null })),
  }));
  return {
    open: runs.find((run) => run.finishedAt === null && run.startedById === profileId) ?? null,
    finished: runs.filter((run) => run.finishedAt !== null),
  };
}

/** Projetos para o gerador de pasta e para vincular uma execução. */
export async function listProjectsForProcesses(): Promise<{ id: string; name: string; clientName: string; ownerName: string; startDate: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, start_date, created_at, is_internal, company:companies(name), owner:profiles!projects_owner_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    clientName: row.is_internal || !row.company ? "Além Filmes" : row.company.name,
    ownerName: row.owner?.full_name ?? "",
    startDate: row.start_date ?? row.created_at.slice(0, 10),
  }));
}
