import { CADENCE_STATUS_CLASSES, CADENCE_STATUS_LABELS } from "@/features/prospeccao/status";
import type { CadenceStatus } from "@/lib/prospeccao/cadence";
import { cn } from "@/lib/utils";

/** Etiqueta do status da cadência: texto + cor, nunca só cor. */
export function CadenceStatusTag({ status, className }: { status: CadenceStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold",
        CADENCE_STATUS_CLASSES[status],
        className,
      )}
    >
      {CADENCE_STATUS_LABELS[status]}
    </span>
  );
}
