import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatCents, type Cents } from "@/features/finance/money";
import { toneColor, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Valor de indicador — o único jeito de mostrar um número grande em card de painel (início,
 * financeiro, CRM, banco de horas, visão do cliente e qualquer painel novo).
 *
 * Regra estrutural: o valor NUNCA quebra linha. Ele fica numa caixa própria com
 * `container-type: inline-size` e o tamanho da fonte é
 * `clamp(mínimo, largura da caixa ÷ nº de caracteres, máximo)` — encolhe junto com a coluna em vez
 * de quebrar. Só se a coluna ficar menor que o tamanho mínimo é que o fim vira reticências (e o
 * valor completo continua no `title`). Algarismos tabulares para alinhar colunas. Rótulos podem
 * quebrar; valores, não. Estilos em app/globals.css (.metric-value).
 */

export type MetricFormat = "cents" | "number" | "percent" | "text";
export type MetricSize = "sm" | "md" | "lg" | "xl" | "display";

const MAX_SIZE: Record<MetricSize, string> = {
  sm: "1.25rem",
  md: "1.75rem",
  lg: "1.875rem",
  xl: "2.5rem",
  /** Relógio do ponto e números-herói. */
  display: "3.75rem",
};

const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatMetric(value: number | string | null | undefined, format: MetricFormat): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  switch (format) {
    case "cents":
      return formatCents(value as Cents);
    case "percent":
      return `${percentFormat.format(value)}%`;
    case "number":
      return numberFormat.format(value);
    case "text":
      return String(value);
  }
}

interface MetricValueProps {
  value: number | string | null | undefined;
  /** "cents" para dinheiro (centavos inteiros), "percent" para 0–100, "number" para contagens. */
  format?: MetricFormat;
  size?: MetricSize;
  tone?: StatusTone;
  className?: string;
}

export function MetricValue({ value, format = "number", size = "lg", tone, className }: MetricValueProps) {
  const text = formatMetric(value, format);
  const color = tone ? toneColor(tone) : undefined;
  const style = {
    "--metric-chars": Math.max(text.length, 4),
    "--metric-max-size": MAX_SIZE[size],
    color,
  } as CSSProperties;

  return (
    <span className={cn("metric-box", className)}>
      <span className="metric-value font-display font-black tracking-tight" style={style} title={text}>
        {text}
      </span>
    </span>
  );
}

interface MetricProps {
  label: ReactNode;
  icon?: LucideIcon;
  value: number | string | null | undefined;
  format?: MetricFormat;
  size?: MetricSize;
  tone?: StatusTone;
  note?: ReactNode;
  className?: string;
}

/** Rótulo (pode quebrar) + valor (nunca quebra) + nota opcional. */
export function Metric({ label, icon: Icon, value, format, size = "md", tone, note, className }: MetricProps) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="flex items-start gap-1.5 text-xs font-semibold text-muted-foreground">
        {Icon ? <Icon className="mt-px size-3.5 shrink-0" aria-hidden /> : null}
        <span className="min-w-0">{label}</span>
      </p>
      <MetricValue value={value} format={format} size={size} tone={tone} />
      {note ? <p className="text-xs text-subtle">{note}</p> : null}
    </div>
  );
}

/**
 * Grade de indicadores: cada métrica na própria coluna (min-width: 0), 24px de espaço. `min`
 * define a largura mínima de cada coluna antes de ir para a próxima linha.
 */
export function MetricGrid({ children, min = "9rem", className }: { children: ReactNode; min?: string; className?: string }) {
  return (
    <div className={cn("metric-grid", className)} style={{ "--metric-col-min": min } as CSSProperties}>
      {children}
    </div>
  );
}
