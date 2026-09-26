"use client";

import { Money } from "@/components/ui/money";
import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { HealthQuickDialog } from "@/components/companies/health-quick-dialog";
import { HealthDot, LifecycleBadge, TierBadge } from "@/components/companies/company-meta";
import { StatusBar } from "@/components/ui/status-bar";
import { toCents } from "@/features/finance/money";
import { CLIENT_HEALTH_TONE } from "@/lib/status";
import { formatDateShort } from "@/lib/format";
import { SURFACE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";

interface CompanyCardProps {
  company: Company;
  activeProjects: number;
  lastActivity: string | null;
  canManage: boolean;
  /** Soma dos contratos (só chega preenchido para quem tem acesso ao financeiro). */
  contractValue?: number | null;
  /** No quadro por nível o selo de nível é redundante. */
  hideTier?: boolean;
}

/**
 * Card de empresa: superfície em gradiente com brilho no hover, barra lateral na cor da saúde,
 * logo/monograma, cidade, projetos ativos e última atividade. Prospect tem borda tracejada — nunca
 * se confunde com cliente.
 */
export function CompanyCard({ company, activeProjects, lastActivity, canManage, contractValue, hideTier = false }: CompanyCardProps) {
  const [healthOpen, setHealthOpen] = useState(false);
  const isProspect = company.lifecycle === "prospect";

  return (
    <div className={cn(SURFACE.card, "group relative overflow-hidden rounded-lg pl-1", isProspect && "border-dashed")}>
      <StatusBar tone={CLIENT_HEALTH_TONE[company.health]} side="left" />
      <Link href={`/clientes/${company.id}`} className="block p-4 pl-3 outline-none">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar name={company.name} logoUrl={company.logo_url} size="md" className="shrink-0" />
            <div className="min-w-0">
              {/* O ponto fica numa caixa da altura de UMA linha do nome (1lh): centralizado na primeira linha em qualquer tamanho. */}
              <p className="flex min-w-0 items-start gap-2 leading-snug">
                <span className="flex h-[1lh] shrink-0 items-center">
                  <HealthDot health={company.health} />
                </span>
                <span className="line-clamp-2 font-bold text-foreground group-hover:underline">{company.name}</span>
              </p>
              {company.city ? <p className="truncate text-[12px] text-muted-foreground">{company.city}</p> : null}
            </div>
          </div>
          {isProspect ? <LifecycleBadge lifecycle={company.lifecycle} /> : null}
        </div>

        {!hideTier && company.tier ? (
          <div className="mt-3">
            <TierBadge tier={company.tier} />
          </div>
        ) : null}

        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="truncate text-subtle">Projetos ativos</dt>
            <dd className="shrink-0 font-bold tabular-nums text-foreground">{activeProjects}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="truncate text-subtle">Última atividade</dt>
            <dd className="shrink-0 whitespace-nowrap font-semibold text-foreground">{lastActivity ? formatDateShort(lastActivity.slice(0, 10)) : "—"}</dd>
          </div>
          {contractValue != null ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="truncate text-subtle">Contratos</dt>
              <dd className="shrink-0 whitespace-nowrap font-bold tabular-nums text-foreground"><Money cents={toCents(contractValue)} /></dd>
            </div>
          ) : null}
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
