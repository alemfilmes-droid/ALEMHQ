"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientRespondedDialog } from "@/features/crm/components/flow/client-responded-dialog";
import { LossDialog } from "@/features/crm/components/flow/loss-dialog";
import { MeetingOutcomeDialog } from "@/features/crm/components/flow/meeting-outcome-dialog";
import { NegotiationDialog } from "@/features/crm/components/flow/negotiation-dialog";
import { ProposalDialog } from "@/features/crm/components/flow/proposal-dialog";
import { QualificationGateDialog } from "@/features/crm/components/flow/qualification-gate-dialog";
import { ReheatDialog } from "@/features/crm/components/flow/reheat-dialog";
import { RegisterContactDialog } from "@/features/crm/components/flow/register-contact-dialog";
import { ScheduleMeetingDialog } from "@/features/crm/components/flow/schedule-meeting-dialog";
import { StageChangeDialog } from "@/features/crm/components/flow/stage-change-dialog";
import { WonDialog } from "@/features/crm/components/flow/won-dialog";
import { DealDetailModal } from "@/features/crm/components/deal-detail-modal";
import type { DealFormOptions } from "@/features/crm/types";
import type { DealStage, DealWithDetails } from "@/types";

type ActiveFlow =
  | { type: "stage"; deal: DealWithDetails; stage: DealStage }
  | { type: "contact"; deal: DealWithDetails }
  | { type: "response"; deal: DealWithDetails }
  | { type: "schedule"; deal: DealWithDetails }
  | { type: "gate"; deal: DealWithDetails; goal: string; next: ActiveFlow }
  | { type: "outcome"; deal: DealWithDetails; meeting: { id: string; scheduledAt: string | null } }
  | { type: "proposal"; deal: DealWithDetails }
  | { type: "negotiation"; deal: DealWithDetails }
  | { type: "won"; deal: DealWithDetails }
  | { type: "loss"; deal: DealWithDetails }
  | { type: "reheat"; deal: DealWithDetails };

export interface CrmFlow {
  /** Incrementa a cada fluxo concluído — o detalhe do negócio usa para recarregar. */
  version: number;
  openDeal: (dealId: string) => void;
  /** Mudança de etapa: escolhe o diálogo certo (interação, reunião, proposta, negociação, ganho, perda). */
  requestStage: (deal: DealWithDetails, stage: DealStage) => void;
  logContact: (deal: DealWithDetails) => void;
  clientResponded: (deal: DealWithDetails) => void;
  scheduleMeeting: (deal: DealWithDetails) => void;
  registerOutcome: (deal: DealWithDetails, meeting: { id: string; scheduledAt: string | null }) => void;
  registerProposal: (deal: DealWithDetails) => void;
  registerNegotiation: (deal: DealWithDetails) => void;
  win: (deal: DealWithDetails) => void;
  lose: (deal: DealWithDetails) => void;
  reheat: (deal: DealWithDetails) => void;
  canManageAll: boolean;
  currentUserId: string;
}

const CrmFlowContext = createContext<CrmFlow | null>(null);

export function useCrmFlow(): CrmFlow {
  const context = useContext(CrmFlowContext);
  if (!context) throw new Error("useCrmFlow precisa estar dentro de CrmFlowProvider.");
  return context;
}

interface CrmFlowProviderProps {
  options: DealFormOptions;
  canManageAll: boolean;
  canSeeFinance: boolean;
  currentUserId: string;
  initialOpenId?: string;
  children: ReactNode;
}

export function CrmFlowProvider({ options, canManageAll, canSeeFinance, currentUserId, initialOpenId, children }: CrmFlowProviderProps) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveFlow | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(initialOpenId ?? null);
  const [version, setVersion] = useState(0);

  const finish = useCallback(
    (keepOpen = false) => {
      if (!keepOpen) setActive(null);
      setVersion((current) => current + 1);
      router.refresh();
    },
    [router],
  );

  const isQualified = (deal: DealWithDetails) => deal.is_qualified === true || deal.fast_track === true;

  const requestStage = useCallback(
    (deal: DealWithDetails, stage: DealStage) => {
      if (deal.stage === stage) return;
      if (deal.stage === "perdido") {
        toast.error('Use "Definir reaquecimento" para reabrir um negócio perdido.');
        return;
      }
      const gated = (goal: string, next: ActiveFlow) => setActive(isQualified(deal) ? next : { type: "gate", deal, goal, next });

      switch (stage) {
        case "ganho":
          if (!canManageAll) {
            toast.error("Peça a um head ou diretor para fechar este negócio como ganho.");
            return;
          }
          gated("fechar o negócio", { type: "won", deal });
          return;
        case "perdido":
          setActive({ type: "loss", deal });
          return;
        case "reuniao_agendada":
          gated("agendar a reunião", { type: "schedule", deal });
          return;
        case "reuniao_realizada":
          if (deal.has_pending_meeting && deal.pending_meeting_id) {
            setActive({ type: "outcome", deal, meeting: { id: deal.pending_meeting_id, scheduledAt: null } });
          } else {
            toast.error("Registre o resultado de uma reunião para mover o negócio para esta etapa.");
          }
          return;
        case "proposta_enviada":
          gated("registrar a proposta", { type: "proposal", deal });
          return;
        case "negociacao":
          setActive({ type: "negotiation", deal });
          return;
        default:
          setActive({ type: "stage", deal, stage });
      }
    },
    [canManageAll],
  );

  const flow = useMemo<CrmFlow>(
    () => ({
      version,
      openDeal: setOpenDealId,
      requestStage,
      logContact: (deal) => setActive({ type: "contact", deal }),
      clientResponded: (deal) => setActive({ type: "response", deal }),
      scheduleMeeting: (deal) => requestStage(deal, "reuniao_agendada"),
      registerOutcome: (deal, meeting) => setActive({ type: "outcome", deal, meeting }),
      registerProposal: (deal) => requestStage(deal, "proposta_enviada"),
      registerNegotiation: (deal) => setActive({ type: "negotiation", deal }),
      win: (deal) => requestStage(deal, "ganho"),
      lose: (deal) => setActive({ type: "loss", deal }),
      reheat: (deal) => setActive({ type: "reheat", deal }),
      canManageAll,
      currentUserId,
    }),
    [version, requestStage, canManageAll, currentUserId],
  );

  const close = (next: boolean) => {
    if (!next) setActive(null);
  };

  return (
    <CrmFlowContext.Provider value={flow}>
      {children}

      {openDealId ? (
        <DealDetailModal
          dealId={openDealId}
          options={options}
          canManageAll={canManageAll}
          open
          onOpenChange={(next) => !next && setOpenDealId(null)}
        />
      ) : null}

      {active?.type === "stage" ? (
        <StageChangeDialog deal={active.deal} stage={active.stage} open onOpenChange={close} onDone={() => finish()} />
      ) : null}
      {active?.type === "contact" ? <RegisterContactDialog deal={active.deal} open onOpenChange={close} onDone={() => finish()} /> : null}
      {active?.type === "response" ? (
        <ClientRespondedDialog
          deal={active.deal}
          open
          onOpenChange={close}
          onDone={(advanceTo) => {
            finish();
            if (advanceTo) requestStage(active.deal, advanceTo);
          }}
        />
      ) : null}
      {active?.type === "schedule" ? (
        <ScheduleMeetingDialog
          deal={active.deal}
          options={options}
          currentUserId={currentUserId}
          open
          onOpenChange={close}
          onDone={() => finish()}
          onNeedsQualification={() => setActive({ type: "gate", deal: active.deal, goal: "agendar a reunião", next: active })}
        />
      ) : null}
      {active?.type === "gate" ? (
        <QualificationGateDialog
          dealId={active.deal.id!}
          goal={active.goal}
          open
          onOpenChange={close}
          onQualified={() => {
            setVersion((current) => current + 1);
            router.refresh();
            setActive({ ...active.next, deal: { ...active.next.deal, is_qualified: true } } as ActiveFlow);
          }}
        />
      ) : null}
      {active?.type === "outcome" ? (
        <MeetingOutcomeDialog
          meeting={{ id: active.meeting.id, dealTitle: active.deal.title ?? "", scheduledAt: active.meeting.scheduledAt }}
          open
          onOpenChange={close}
          onDone={(result) => {
            finish();
            if (result === "fechado_na_call") setActive({ type: "won", deal: active.deal });
          }}
        />
      ) : null}
      {active?.type === "proposal" ? (
        <ProposalDialog
          deal={active.deal}
          open
          onOpenChange={close}
          onDone={() => finish()}
          onNeedsQualification={() => setActive({ type: "gate", deal: active.deal, goal: "registrar a proposta", next: active })}
        />
      ) : null}
      {active?.type === "negotiation" ? (
        <NegotiationDialog
          deal={active.deal}
          open
          onOpenChange={close}
          onDone={() => finish()}
          onNeedsResponse={() => setActive({ type: "response", deal: active.deal })}
        />
      ) : null}
      {active?.type === "won" ? (
        <WonDialog deal={active.deal} options={options} canSeeFinance={canSeeFinance} open onOpenChange={close} onDone={() => finish(true)} />
      ) : null}
      {active?.type === "loss" ? <LossDialog deal={active.deal} open onOpenChange={close} onDone={() => finish()} /> : null}
      {active?.type === "reheat" ? <ReheatDialog deal={active.deal} open onOpenChange={close} onDone={() => finish()} /> : null}
    </CrmFlowContext.Provider>
  );
}
