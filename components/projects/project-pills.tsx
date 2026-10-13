import { TintedPill } from "@/components/ui/tinted-pill";
import { MODEL_LABELS, STAGE_LABELS } from "@/lib/domain";
import { PROJECT_MODEL_TINT, projectStageTint } from "@/lib/projects/colors";
import type { ProjectModel, ProjectStage } from "@/types";

/** Pílulas de Projetos (cores em lib/projects/colors). */
export function ProjectModelPill({ model, className }: { model: ProjectModel; className?: string }) {
  return (
    <TintedPill tint={PROJECT_MODEL_TINT[model]} className={className}>
      {MODEL_LABELS[model]}
    </TintedPill>
  );
}

export function ProjectStagePill({ stage, className }: { stage: ProjectStage; className?: string }) {
  return (
    <TintedPill tint={projectStageTint(stage)} className={className}>
      {STAGE_LABELS[stage]}
    </TintedPill>
  );
}

/** Ponto da etapa (lista): a cor da família, no lugar do ponto de status genérico. */
export function ProjectStageDot({ stage }: { stage: ProjectStage }) {
  const tint = projectStageTint(stage);
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${tint.from}, ${tint.to})` }} />;
}
