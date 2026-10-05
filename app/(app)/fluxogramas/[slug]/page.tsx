import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, User, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/link-tabs";
import { SquadBadge } from "@/components/ui/squad-badge";
import { ExecutionMode } from "@/features/processes/components/execution-mode";
import { ProcessHeaderActions } from "@/features/processes/components/process-header-actions";
import { ProcessHistory } from "@/features/processes/components/process-history";
import { ProcessSteps } from "@/features/processes/components/process-steps";
import { ProcessSummary } from "@/features/processes/components/process-summary";
import { getProcess, listInvoiceReceivableOptions, listProcessRuns, listProjectsForProcesses } from "@/features/processes/queries";
import { FREQUENCY_LABELS } from "@/features/processes/types";
import { canEditProcessSquad, hasCapability } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { SQUADS } from "@/lib/auth/squads";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Fluxograma" };

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ aba?: string; modo?: string }>;

export default async function ProcessPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { slug } = await params;
  const { aba, modo } = await searchParams;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) notFound();

  const process = await getProcess(slug);
  if (!process) notFound();

  const canEdit = canEditProcessSquad(profile, process.squad);
  const tab = aba === "historico" ? "historico" : "passos";
  const activeSteps = process.steps.filter((step) => !step.archived);
  const execution = modo === "execucao";
  const needsProjects = tab === "passos" || execution;
  const needsReceivables = needsProjects && hasCapability(profile, "finance") && activeSteps.some((step) => step.tool === "arquivo_nota_fiscal");
  const [runs, projects, receivables] = await Promise.all([
    listProcessRuns(process.id, profile.id),
    needsProjects ? listProjectsForProcesses() : Promise.resolve([]),
    needsReceivables ? listInvoiceReceivableOptions() : Promise.resolve([]),
  ]);

  if (execution) {
    return <ExecutionMode process={process} openRun={runs.open} projects={projects} receivables={receivables} />;
  }

  return (
    <div className="print-light">
      <Link href="/fluxogramas" className="mb-4 inline-flex print:hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Fluxogramas
      </Link>
      <PageHeader
        panel="/fluxogramas"
        title={process.title}
        description={
          <span className="space-y-3">
            {process.summary ? <span className="block">{process.summary}</span> : null}
            <span className="flex flex-wrap items-center gap-2">
              <SquadBadge squad={process.squad} />
              <Badge variant="muted">
                <Clock aria-hidden />
                {FREQUENCY_LABELS[process.frequency]}
              </Badge>
              {process.ownerRole ? (
                <Badge variant="muted">
                  <User aria-hidden />
                  {process.ownerRole}
                </Badge>
              ) : null}
              {!process.isPublished ? <Badge variant="outline">Rascunho</Badge> : null}
              {process.archived ? <Badge variant="outline">Arquivado</Badge> : null}
            </span>
            {process.triggerDescription ? (
              <span className="flex items-start gap-1.5 text-[13px]">
                <Zap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold text-foreground">Começa quando: </span>
                  {process.triggerDescription}
                </span>
              </span>
            ) : null}
          </span>
        }
        actions={canEdit ? <ProcessHeaderActions process={process} squads={SQUADS.filter((squad) => canEditProcessSquad(profile, squad))} /> : undefined}
      />

      <div className="mb-6">
        <ProcessSummary process={process} />
      </div>

      <div className="mb-6 print:hidden">
        <LinkTabs
          label="Seções do fluxograma"
          tabs={[
            { href: `/fluxogramas/${process.slug}`, label: "Passo a passo", active: tab === "passos" },
            { href: `/fluxogramas/${process.slug}?aba=historico`, label: `Histórico (${runs.finished.length})`, active: tab === "historico" },
          ]}
        />
      </div>

      {tab === "historico" ? (
        <ProcessHistory runs={runs.finished} totalSteps={activeSteps.length} />
      ) : (
        <ProcessSteps process={process} canEdit={canEdit} openRun={runs.open} projects={projects} receivables={receivables} />
      )}

      <p className="mt-8 text-[12px] text-subtle">
        Atualizado em {formatDateTime(process.updatedAt)}
        {process.updatedByName ? ` por ${process.updatedByName}` : ""}.
      </p>
    </div>
  );
}
