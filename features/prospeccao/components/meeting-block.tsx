"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { MeetingDialog } from "@/features/prospeccao/components/meeting-dialog";
import { SHEET_ON_MOBILE } from "@/features/prospeccao/components/sheet";
import { cancelMeetingAction, meetingOutcomeAction } from "@/features/prospeccao/meeting-actions";
import type { OpenMeeting } from "@/features/prospeccao/types";
import { formatSlot } from "@/lib/prospeccao/slots";

/** Reunião no card: data e hora com Reagendar/Cancelar; depois do horário, "Reunião aconteceu?". */
export function MeetingBlock({ dealId, leadName, meeting, canAct }: { dealId: string; leadName: string; meeting: OpenMeeting; canAct: boolean }) {
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function answer(held: boolean) {
    startTransition(async () => {
      const result = await meetingOutcomeAction(meeting.id, held);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelMeetingAction(meeting.id, reason);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message);
      setCancelling(false);
    });
  }

  const when = formatSlot(meeting.startsAt);

  return (
    <div className={meeting.awaitingOutcome ? "space-y-3 rounded-lg border-2 border-[#A855F7] bg-[#A855F7]/10 p-3" : "space-y-2 rounded-lg border border-[#A855F7]/60 p-3"}>
      {meeting.awaitingOutcome ? (
        <>
          <p className="text-[15px] font-bold text-foreground">Reunião aconteceu?</p>
          <p className="text-[13px] text-muted-foreground">Estava marcada para {when}.</p>
          {canAct ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" size="lg" loading={pending} className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => answer(true)}>
                Sim
              </Button>
              <Button type="button" size="lg" variant="secondary" disabled={pending} onClick={() => answer(false)}>
                Não compareceu
              </Button>
              <Button type="button" size="lg" variant="secondary" disabled={pending} onClick={() => setRescheduling(true)}>
                Reagendar
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarClock className="size-4 text-[#D8B4FE]" aria-hidden />
            Reunião {when}
            {meeting.meetLink ? (
              <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-normal text-[#D8B4FE] underline underline-offset-4">
                <Video className="size-4" aria-hidden />
                Google Meet
              </a>
            ) : null}
          </p>
          {canAct ? (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button type="button" size="lg" variant="secondary" onClick={() => setRescheduling(true)}>
                Reagendar
              </Button>
              <Button type="button" size="lg" variant="secondary" onClick={() => setCancelling(true)}>
                Cancelar
              </Button>
            </div>
          ) : null}
        </>
      )}

      {canAct ? <MeetingDialog dealId={dealId} leadName={leadName} meetingId={meeting.id} open={rescheduling} onOpenChange={setRescheduling} /> : null}
      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent className={`max-w-md ${SHEET_ON_MOBILE}`}>
          <DialogHeader>
            <DialogTitle>Cancelar reunião</DialogTitle>
            <DialogDescription>Sai da agenda do Anderson e o lead volta para Em conversa.</DialogDescription>
          </DialogHeader>
          <FormField id={`cancelar-${meeting.id}`} label="Motivo">
            <Input id={`cancelar-${meeting.id}`} className="h-11" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="lg" onClick={() => setCancelling(false)}>
              Voltar
            </Button>
            <Button type="button" size="lg" loading={pending} disabled={reason.trim().length < 2} onClick={cancel}>
              Cancelar reunião
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
