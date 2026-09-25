import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS } from "@/lib/domain";
import type { ProjectPriority } from "@/types";

/** Só aparece para alta/urgente — contorno, sem preenchimento. */
export function PautaPriorityBadge({ priority }: { priority: ProjectPriority }) {
  if (priority !== "alta" && priority !== "urgente") return null;
  return (
    <Badge variant="outline" className={priority === "urgente" ? "border-2 border-foreground font-bold" : undefined}>
      {priority === "urgente" ? <AlertTriangle className="size-3" aria-hidden /> : null}
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
