import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

interface UnderConstructionProps {
  title: string;
  description: string;
  /** Rota do painel, para o ícone do cabeçalho. */
  panel?: string;
}

/** Estado limpo para módulos futuros. */
export function UnderConstruction({ title, description, panel }: UnderConstructionProps) {
  return (
    <>
      <PageHeader title={title} panel={panel} />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-24 text-center">
        <span className="mb-5 flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface-raised">
          <Hammer className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="font-display text-2xl font-black tracking-tight">Em construção.</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </>
  );
}
