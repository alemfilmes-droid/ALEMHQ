"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CalendarDays, Check, MessageCircle, PauseCircle, Play, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { resumeLeadAction, markRespondedAction } from "@/features/prospeccao/cadence-actions";
import { CadenceStatusTag } from "@/features/prospeccao/components/cadence-status-tag";
import { HouseSwitcher } from "@/features/prospeccao/components/house-switcher";
import { MeetingBlock } from "@/features/prospeccao/components/meeting-block";
import { MeetingDialog } from "@/features/prospeccao/components/meeting-dialog";
import { ObjectionDialog } from "@/features/prospeccao/components/objection-dialog";
import { ReasonDialog } from "@/features/prospeccao/components/reason-dialog";
import { SendPreviewDialog } from "@/features/prospeccao/components/send-preview-dialog";
import { SentAtDialog } from "@/features/prospeccao/components/sent-at-dialog";
import { TouchHistory } from "@/features/prospeccao/components/touch-history";
import { useSave } from "@/features/prospeccao/components/use-save";
import { useUndoable } from "@/features/prospeccao/components/use-undoable";
import { WhatsAppIcon } from "@/features/prospeccao/components/whatsapp-icon";
import { markSentAction } from "@/features/prospeccao/send-actions";
import { touchLabel } from "@/features/prospeccao/status";
import type { ObjectionOption, QueueItem } from "@/features/prospeccao/types";
import { dayMonthShort, weekdayShort } from "@/lib/calendar";
import { cn } from "@/lib/utils";

/**
 * Cores das ações (spec 8), sempre ícone + texto. Contraste AA: #0A0A0A sobre #25D366 ≈ 11:1;
 * branco sobre #0E7A35 ≈ 5,4:1; branco sobre #1D4ED8 ≈ 6,7:1; branco sobre #7C3AED ≈ 5,7:1;
 * #1A1100 sobre #F5A524 ≈ 10:1.
 * O vermelho da marca não aparece aqui.
 */
const ACTION = {
  sent: "border border-[#25D366] bg-transparent text-[#86EFAC] hover:bg-[#25D366]/10",
  sentPending: "border border-[#0E7A35] bg-[#0E7A35] text-white hover:bg-[#0B6A2D]",
  replied: "bg-[#1D4ED8] text-white hover:bg-[#1E40AF]",
  objection: "bg-[#F5A524] text-[#1A1100] hover:bg-[#E09612]",
  meeting: "bg-[#7C3AED] text-white hover:bg-[#6D28D9]",
  neutral: "border border-border-strong bg-transparent text-foreground hover:bg-surface-hover",
} as const;

const INACTIVE = new Set(["em_conversa", "reuniao_marcada", "pausado", "descartado"]);

function dueLabel(day: string, today: string): string {
  return day === today ? "hoje" : `${weekdayShort(day)}, ${dayMonthShort(day)}`;
}

interface Props {
  item: QueueItem;
  today: string;
  canAct: boolean;
  objections: ObjectionOption[];
}

/** Card do lead na fila: topo com status, "Enviar no WhatsApp" em destaque e as outras ações abaixo. */
export function ProspectLeadCard({ item, today, canAct, objections }: Props) {
  const flow = useCrmFlow();
  const [dialog, setDialog] = useState<"enviar" | "enviado_em" | "objecao" | "motivo" | "reuniao" | null>(null);
  const undoable = useUndoable();
  const resume = useSave();
  const { state } = item;
  const touch = touchLabel(state);
  const canSend = canAct && !item.demo && state.applicableScript !== null;
  const active = !INACTIVE.has(state.status);

  const header = (
    <span className="min-w-0 flex-1 space-y-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="truncate text-[15px] font-bold text-foreground">{item.leadName}</span>
        <CadenceStatusTag status={state.status} />
        {item.house ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#22D3EE]/70 px-2.5 py-0.5 text-xs font-bold text-[#A5F3FC]">
            Cliente da casa
          </span>
        ) : null}
        {item.demo ? <Badge variant="muted">demonstração</Badge> : null}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
        <span>{item.playbookName}</span>
        {touch ? (
          <>
            <span aria-hidden>·</span>
            <span className="font-semibold text-foreground">{touch}</span>
          </>
        ) : null}
        {state.nextDueDate ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {state.status === "atrasado" ? "previsto " : ""}
              {dueLabel(state.nextDueDate, today)}
            </span>
          </>
        ) : null}
      </span>
    </span>
  );

  return (
    <li className="space-y-3 rounded-lg border border-border bg-surface p-4">
      {item.meeting?.awaitingOutcome ? <MeetingBlock dealId={item.dealId} leadName={item.leadName} meeting={item.meeting} canAct={canAct} /> : null}
      {item.demo ? (
        <div className="flex">{header}</div>
      ) : (
        <button type="button" onClick={() => flow.openDeal(item.dealId)} className="flex min-h-11 w-full text-left hover:underline">
          {header}
        </button>
      )}

      {item.meeting && !item.meeting.awaitingOutcome ? <MeetingBlock dealId={item.dealId} leadName={item.leadName} meeting={item.meeting} canAct={canAct} /> : null}

      {item.house?.canSwitch && canAct ? (
        <HouseSwitcher dealId={item.dealId} current={item.house.options[0]?.id ?? ""} options={item.house.options} />
      ) : null}

      {item.phoneNotice && canSend ? (
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[#FCD34D]">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {item.phoneNotice}
        </p>
      ) : null}

      {canSend ? (
        <Button type="button" onClick={() => setDialog("enviar")} className="h-12 w-full bg-[#25D366] text-base font-bold text-[#0A0A0A] hover:bg-[#1FBF5B]">
          <WhatsAppIcon className="size-5" />
          Enviar no WhatsApp
        </Button>
      ) : null}

      {canAct && !item.demo ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {state.applicableScript ? (
            <Button
              type="button"
              size="lg"
              className={cn("px-3 text-sm", item.hasPending ? ACTION.sentPending : ACTION.sent)}
              disabled={!item.hasPending}
              title={item.hasPending ? undefined : "Abra o WhatsApp pelo HQ primeiro."}
              loading={undoable.pending}
              onClick={() => undoable.run(() => markSentAction(item.dealId))}
            >
              <Check aria-hidden />
              Marcar enviado
            </Button>
          ) : null}
          {active ? (
            <Button type="button" size="lg" className={cn("px-3 text-sm", ACTION.replied)} onClick={() => undoable.run(() => markRespondedAction(item.dealId))}>
              <MessageCircle aria-hidden />
              Respondeu
            </Button>
          ) : null}
          {!item.meeting && state.status !== "pausado" && state.status !== "descartado" ? (
            <Button type="button" size="lg" className={cn("px-3 text-sm", ACTION.meeting)} onClick={() => setDialog("reuniao")}>
              <CalendarClock aria-hidden />
              Marcar reunião
            </Button>
          ) : null}
          {state.status !== "descartado" ? (
            <Button type="button" size="lg" className={cn("px-3 text-sm", ACTION.objection)} onClick={() => setDialog("objecao")}>
              <ShieldAlert aria-hidden />
              Objeção
            </Button>
          ) : null}
          {state.status === "pausado" ? (
            <Button type="button" size="lg" className={cn("px-3 text-sm", ACTION.neutral)} loading={resume.pending} onClick={() => resume.run(() => resumeLeadAction(item.dealId))}>
              <Play aria-hidden />
              Retomar
            </Button>
          ) : state.status !== "descartado" ? (
            <Button type="button" size="lg" className={cn("px-3 text-sm", ACTION.neutral)} onClick={() => setDialog("motivo")}>
              <PauseCircle aria-hidden />
              Pausar / Descartar
            </Button>
          ) : null}
        </div>
      ) : null}
      {canAct && !item.demo && state.applicableScript && item.hasPending ? (
        <Button type="button" variant="link" className="min-h-11 self-start sm:min-h-0" onClick={() => setDialog("enviado_em")}>
          Enviei em outro horário
        </Button>
      ) : null}

      {item.demo ? null : <TouchHistory dealId={item.dealId} />}

      {canSend ? (
        <SendPreviewDialog dealId={item.dealId} leadName={item.leadName} touch={touch} open={dialog === "enviar"} onOpenChange={(open) => setDialog(open ? "enviar" : null)} />
      ) : null}
      {canAct && !item.demo ? (
        <>
          <ObjectionDialog dealId={item.dealId} objections={objections} today={today} open={dialog === "objecao"} onOpenChange={(open) => setDialog(open ? "objecao" : null)} />
          <ReasonDialog dealId={item.dealId} open={dialog === "motivo"} onOpenChange={(open) => setDialog(open ? "motivo" : null)} />
          {dialog === "enviado_em" ? (
            <SentAtDialog
              leadName={item.leadName}
              open
              onOpenChange={(open) => setDialog(open ? "enviado_em" : null)}
              onConfirm={(occurred) => undoable.run(() => markSentAction(item.dealId, occurred))}
            />
          ) : null}
          {!item.meeting ? (
            <MeetingDialog dealId={item.dealId} leadName={item.leadName} open={dialog === "reuniao"} onOpenChange={(open) => setDialog(open ? "reuniao" : null)} />
          ) : null}
        </>
      ) : null}
    </li>
  );
}
