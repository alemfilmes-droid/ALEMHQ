import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Tabela que rola dentro do próprio contêiner no mobile. */
export function TableShell({ children, minWidth = "min-w-[880px]" }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className={`w-full border-collapse text-left text-sm ${minWidth}`}>{children}</table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return (
    <th scope="col" className={`eyebrow border-b border-border px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-14 text-center">
      <Icon className="mb-3 size-6 text-muted-foreground" aria-hidden />
      <p className="font-bold">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
