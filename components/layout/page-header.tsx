import type { ReactNode } from "react";
import { PanelIcon } from "@/components/layout/panel-icon";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  /** Rota do painel: mostra o ícone do módulo na cor do squad dono (ver PANEL_TONE em lib/theme). */
  panel?: string;
  /** Elemento à esquerda do título no lugar do ícone do painel (ex.: logo do cliente). */
  leading?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions, panel, leading }: PageHeaderProps) {
  const lead = leading ?? (panel ? <PanelIcon href={panel} /> : null);

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {lead ? <div className="mt-1 shrink-0">{lead}</div> : null}
        <div className="min-w-0 space-y-2">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="page-title break-words">{title}</h1>
          {description ? <div className="max-w-2xl text-sm text-muted-foreground">{description}</div> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
