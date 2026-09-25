"use client";

import { ExternalLink as LinkIcon, FileText } from "lucide-react";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { INTERACTION_CHANNEL_LABELS, PROPOSAL_CHANNEL_LABELS, PROPOSAL_STATUS_LABELS } from "@/features/crm/labels";
import { formatCents, toCents } from "@/features/finance/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { DealNegotiation, DealProposal, DealWithDetails } from "@/types";

interface ProposalsSectionProps {
  deal: DealWithDetails;
  proposals: DealProposal[];
  negotiations: DealNegotiation[];
  closed: boolean;
}

export function ProposalsSection({ deal, proposals, negotiations, closed }: ProposalsSectionProps) {
  const flow = useCrmFlow();
  const canPropose = !closed && (deal.fast_track || (deal.stage !== null && ["reuniao_realizada", "proposta_enviada", "negociacao"].includes(deal.stage)));

  return (
    <div className="space-y-4">
      {!closed ? (
        <div className="flex flex-wrap gap-2">
          {canPropose ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => flow.registerProposal(deal)}>
              <FileText aria-hidden />
              {proposals.length > 0 ? "Nova revisão de proposta" : "Registrar proposta"}
            </Button>
          ) : null}
          {proposals.length > 0 ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => flow.registerNegotiation(deal)}>
              Registrar negociação
            </Button>
          ) : null}
        </div>
      ) : null}

      {proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canPropose || closed ? "Nenhuma proposta registrada." : "A proposta só pode ser registrada depois da reunião."}
        </p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{formatCents(toCents(proposal.amount))}</p>
                <Badge variant="outline">{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {formatDateTime(proposal.sent_at)} · {PROPOSAL_CHANNEL_LABELS[proposal.sent_channel]}
              </p>
              {proposal.scope_notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{proposal.scope_notes}</p> : null}
              {proposal.document_url ? (
                <a
                  href={proposal.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4"
                >
                  <LinkIcon className="size-3.5" aria-hidden />
                  Abrir PDF
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {negotiations.length > 0 ? (
        <div className="space-y-2">
          <p className="eyebrow">Negociações</p>
          <ul className="space-y-3">
            {negotiations.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                <p className="flex flex-wrap gap-x-4 gap-y-1 font-semibold">
                  {item.client_counter_amount != null ? <span>Cliente: {formatCents(toCents(item.client_counter_amount))}</span> : null}
                  {item.our_counter_amount != null ? <span>Nós: {formatCents(toCents(item.our_counter_amount))}</span> : null}
                  {item.agreed_amount != null ? <span>Acordado: {formatCents(toCents(item.agreed_amount))}</span> : null}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {formatDateTime(item.created_at)}
                  {item.channel ? ` · ${INTERACTION_CHANNEL_LABELS[item.channel]}` : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{item.notes}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
