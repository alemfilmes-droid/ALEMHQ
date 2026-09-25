"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { HealthQuickDialog } from "@/components/companies/health-quick-dialog";
import { HealthDot, LifecycleBadge, TierBadge } from "@/components/companies/company-meta";
import { StatusBar } from "@/components/ui/status-bar";
import { CLIENT_HEALTH_TONE } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Company } from "@/types";

interface CompanyCardProps {
  company: Company;
  activeProjects: number;
  lastActivity: string | null;
  canManage: boolean;
}

export function CompanyCard({ company, activeProjects, lastActivity, canManage }: CompanyCardProps) {
  const [healthOpen, setHealthOpen] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card pl-4 transition-colors hover:border-border-strong">
      <StatusBar tone={CLIENT_HEALTH_TONE[company.health]} side="left" />
      <Link href={`/clientes/${company.id}`} className="block p-4 pl-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar name={company.name} logoUrl={company.logo_url} size="md" />
            <div className="flex min-w-0 items-center gap-2">
              <HealthDot health={company.health} />
              <p className="truncate font-bold text-foreground group-hover:underline">{company.name}</p>
            </div>
          </div>
          <LifecycleBadge lifecycle={company.lifecycle} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TierBadge tier={company.tier} />
          {company.city ? <span className="text-[13px] text-muted-foreground">{company.city}</span> : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[13px]">
          <div>
            <dt className="text-subtle">Projetos ativos</dt>
            <dd className="mt-0.5 font-bold text-foreground">{activeProjects}</dd>
          </div>
          <div>
            <dt className="text-subtle">Última atividade</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{lastActivity ? formatDate(lastActivity) : "—"}</dd>
          </div>
        </dl>
      </Link>

      {canManage ? (
        <div className="flex items-center justify-end border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setHealthOpen(true)}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Pencil className="size-3" aria-hidden />
            Saúde
          </button>
        </div>
      ) : null}

      {healthOpen ? <HealthQuickDialog company={company} open={healthOpen} onOpenChange={setHealthOpen} /> : null}
    </div>
  );
}
