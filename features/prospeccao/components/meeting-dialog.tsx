"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { SHEET_ON_MOBILE } from "@/features/prospeccao/components/sheet";
import { WhatsAppBubble } from "@/features/prospeccao/components/whatsapp-bubble";
import { WhatsAppIcon } from "@/features/prospeccao/components/whatsapp-icon";
import {
  checkSlotAction,
  confirmMeetingAction,
  meetingHostOptionsAction,
  rescheduleMeetingAction,
  suggestMeetingAction,
  type SuggestResult,
  type SuggestedSlot,
} from "@/features/prospeccao/meeting-actions";
import { appZoneToIso } from "@/lib/calendar";
import { hostChoiceLabel, MEETING_HOST_CHOICES, type MeetingHostChoice } from "@/lib/prospeccao/meeting-host";
import { whatsappUrl } from "@/lib/prospeccao/message";
import { cn } from "@/lib/utils";

const OTHER = "outro";

interface Props {
  dealId: string;
  leadName: string;
  /** Reagendar: a reunião que muda de horário (o mesmo evento no Google). */
  meetingId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Marcar reunião: primeiro a escolha obrigatória — com o Anderson ou com o SDR (kick-off); depois os
 * horários livres de quem atende, a frase para o cliente e a confirmação. Reagendar mantém quem atende.
 */
export function MeetingDialog({ dealId, leadName, meetingId, open, onOpenChange }: Props) {
  const flow = useCrmFlow();
  const [host, setHost] = useState<MeetingHostChoice | null>(null);
  const [names, setNames] = useState<{ ceo: string | null; sdr: string | null } | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [slots, setSlots] = useState<SuggestedSlot[]>([]);
  const [choice, setChoice] = useState<string>("0");
  const [other, setOther] = useState({ date: "", time: "09:00" });
  const [otherCheck, setOtherCheck] = useState<{ free: boolean; insideWindows: boolean } | null>(null);
  const [override, setOverride] = useState(false);
  const [meet, setMeet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choosing = !meetingId && host === null;

  function load(choice: MeetingHostChoice | null = host) {
    setSuggestion(null);
    setError(null);
    suggestMeetingAction(dealId, choice, meetingId).then((result) => {
      setSuggestion(result);
      if (result.ok) setSlots(result.slots);
    });
  }

  useEffect(() => {
    if (!open) return;
    if (meetingId) load(null);
    else {
      setHost(null);
      meetingHostOptionsAction(dealId).then(setNames);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só ao abrir
  }, [open, dealId]);

  function choose(choice: MeetingHostChoice) {
    setHost(choice);
    load(choice);
  }

  const otherIso = other.date ? appZoneToIso(other.date, other.time) : null;
  const startIso = choice === OTHER ? otherIso : (slots[Number(choice)]?.start ?? null);

  function checkOther() {
    if (!otherIso) return;
    setOtherCheck(null);
    setOverride(false);
    checkSlotAction(otherIso, dealId, host, meetingId).then((result) => (result.ok ? setOtherCheck(result) : setError(result.error)));
  }

  function confirm() {
    if (!startIso) return setError("Escolha um horário.");
    setError(null);
    startTransition(async () => {
      const input = { startIso, meet, override };
      const result = meetingId ? await rescheduleMeetingAction(meetingId, input) : await confirmMeetingAction(dealId, host, input);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        return;
      }
      setError(result.error);
      if (result.slots) {
        setSlots(result.slots);
        setChoice("0");
      }
      if (result.outsideWindows) setOtherCheck({ free: true, insideWindows: false });
    });
  }

  // Tudo síncrono no clique, como no Enviar no WhatsApp (o navegador só abre outra aba assim).
  function sendOffer(text: string, recipient: string) {
    const url = whatsappUrl(recipient, text);
    if (window.matchMedia("(pointer: coarse)").matches) window.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  const option = (active: boolean) =>
    cn(
      "flex min-h-14 w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-[15px] font-semibold transition-colors",
      active ? "border-[#A855F7] bg-[#A855F7]/15 text-foreground" : "border-border-strong text-muted-foreground hover:text-foreground",
    );
  const needsOverride = choice === OTHER && otherCheck !== null && (!otherCheck.free || !otherCheck.insideWindows);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-xl ${SHEET_ON_MOBILE}`}>
        <DialogHeader>
          <DialogTitle>{meetingId ? "Reagendar reunião" : "Marcar reunião"} · {leadName}</DialogTitle>
          <DialogDescription>
            {choosing
              ? "Com quem é a reunião? Os horários livres e o evento saem da agenda de quem vai atender."
              : `Horários livres na agenda de ${suggestion?.ok ? suggestion.hostName.split(" ")[0] : "quem atende"}, só em dias úteis.`}
          </DialogDescription>
        </DialogHeader>

        {choosing ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Com quem é a reunião</legend>
            {MEETING_HOST_CHOICES.map((choice) => (
              <button key={choice} type="button" className={option(false)} disabled={!names} onClick={() => choose(choice)}>
                <CalendarClock className="size-5 shrink-0" aria-hidden />
                {names ? hostChoiceLabel(choice, { ceo: names.ceo ?? "Anderson", sdr: names.sdr ?? "SDR" }) : "Carregando…"}
              </button>
            ))}
            <p className="text-[13px] text-muted-foreground">Com o SDR (kick-off), a reunião fica na agenda dele e nada vai para o Anderson.</p>
          </fieldset>
        ) : !suggestion ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !suggestion.ok ? (
          <div className="space-y-3">
            <Alert variant="error">{suggestion.error}</Alert>
            {suggestion.needsQualification ? (
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  onOpenChange(false);
                  flow.openDeal(dealId);
                }}
              >
                Abrir qualificação
              </Button>
            ) : (
              <Button type="button" size="lg" variant="secondary" onClick={() => load()}>
                <RefreshCcw aria-hidden />
                Tentar de novo
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-foreground">Horário ({suggestion.durationMinutes} min)</legend>
              {slots.map((slot, index) => (
                <label key={slot.start} className={option(choice === String(index))}>
                  <input type="radio" name={`slot-${dealId}`} className="sr-only" checked={choice === String(index)} onChange={() => setChoice(String(index))} />
                  <CalendarClock className="size-5 shrink-0" aria-hidden />
                  {slot.label.charAt(0).toUpperCase() + slot.label.slice(1)}
                </label>
              ))}
              <label className={option(choice === OTHER)}>
                <input type="radio" name={`slot-${dealId}`} className="sr-only" checked={choice === OTHER} onChange={() => setChoice(OTHER)} />
                Outro horário
              </label>
              {choice === OTHER ? (
                <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                  <FormField id={`outro-data-${dealId}`} label="Data">
                    <Input id={`outro-data-${dealId}`} type="date" className="h-11" value={other.date} onChange={(event) => setOther({ ...other, date: event.target.value })} />
                  </FormField>
                  <FormField id={`outro-hora-${dealId}`} label="Hora">
                    <Input id={`outro-hora-${dealId}`} type="time" step={900} className="h-11" value={other.time} onChange={(event) => setOther({ ...other, time: event.target.value })} />
                  </FormField>
                  <Button type="button" variant="secondary" size="lg" disabled={!other.date} onClick={checkOther}>
                    Conferir
                  </Button>
                  {otherCheck && otherCheck.free && otherCheck.insideWindows ? (
                    <p className="text-[13px] font-semibold text-[#86EFAC] sm:col-span-3">Livre na agenda de {suggestion.hostName.split(" ")[0]}.</p>
                  ) : null}
                  {needsOverride ? (
                    <div className="space-y-2 sm:col-span-3">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-[#FCD34D]">
                        <AlertTriangle className="size-4 shrink-0" aria-hidden />
                        {!otherCheck?.free ? `${suggestion.hostName.split(" ")[0]} já tem compromisso nesse horário.` : "Fora das janelas de reunião (9h–12h e 14h–17h, dias úteis)."}
                      </p>
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <Checkbox checked={override} onCheckedChange={(checked) => setOverride(checked === true)} className="size-5" />
                        Marcar mesmo assim
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </fieldset>

            {!meetingId ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Frase para o cliente</p>
                <WhatsAppBubble text={suggestion.offerText} />
                {suggestion.offerWarning ? <p className="text-[13px] text-[#FCD34D]">{suggestion.offerWarning}</p> : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <CopyButton value={suggestion.offerText} label="Copiar frase" size="lg" copiedMessage="Frase copiada." />
                  {suggestion.recipient ? (
                    <Button
                      type="button"
                      size="lg"
                      className="bg-[#25D366] text-[#0A0A0A] hover:bg-[#1FBF5B]"
                      onClick={() => sendOffer(suggestion.offerText, suggestion.recipient ?? "")}
                    >
                      <WhatsAppIcon className="size-5" />
                      Enviar no WhatsApp
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {suggestion.hostGoogle ? (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox checked={meet} onCheckedChange={(checked) => setMeet(checked === true)} className="size-5" />
                Gerar link do Google Meet
              </label>
            ) : null}

            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="lg"
                loading={pending}
                disabled={!startIso || (needsOverride && !override)}
                onClick={confirm}
                className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
              >
                <CalendarClock aria-hidden />
                Confirmar horário
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
