import { cn } from "@/lib/utils";
import { toneColor, type StatusTone } from "@/lib/status";

interface StatusBarProps {
  tone: StatusTone;
  side?: "left" | "top";
  className?: string;
}

/** Barra de 3px usada na lateral ou no topo de um card. */
export function StatusBar({ tone, side = "left", className }: StatusBarProps) {
  const color = toneColor(tone);
  return (
    <span
      aria-hidden
      className={cn("absolute inset-x-0 top-0 h-[3px]", side === "left" && "inset-x-auto inset-y-0 left-0 h-auto w-[3px]", className)}
      style={{ background: color ?? "var(--border-strong)" }}
    />
  );
}
