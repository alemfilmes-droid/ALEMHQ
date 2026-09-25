import { cn } from "@/lib/utils";
import { toneColor, type StatusTone } from "@/lib/status";

interface StatusDotProps {
  tone: StatusTone;
  className?: string;
  label?: string;
}

/** Indicador de 8px. Cor só aparece aqui — nunca em fundo de botão, card ou título. */
export function StatusDot({ tone, className, label }: StatusDotProps) {
  const color = toneColor(tone);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      title={label}
      className={cn("inline-block size-2 shrink-0 rounded-full", !color && "bg-subtle", className)}
      style={color ? { background: color } : undefined}
    />
  );
}
