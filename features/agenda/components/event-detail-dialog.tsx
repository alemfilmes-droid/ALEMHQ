"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Eye, MapPin, Pencil, Repeat, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusDot } from "@/components/ui/status-dot";
import { cancelCommitmentAction } from "@/features/agenda/actions";
import { describeRRule } from "@/features/agenda/recurrence";
import { eventTimeLabel } from "@/features/agenda/layout";
import type { AgendaEvent, AgendaOptionMember } from "@/features/agenda/types";
import { COMMITMENT_KIND_LABELS, COMMITMENT_STATUS_LABELS } from "@/features/crm/labels";
import { dateInAppZone, dayMonthShort, weekdayLong } from "@/lib/calendar";
import { COMMITMENT_KIND_TONE } from "@/lib/status";

interface EventDetailDialogProps {
  event: AgendaEvent;
  members: AgendaOptionMember[];
  onOpenChange: (open: boolean) => void;
  onEdit: (commitmentId: string) => void;
  onCancelled: () => void;
}

function reminderLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? "dia" : "dias"} antes`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} h antes`;
  return `${minutes} min antes`;
}

export function EventDetailDialog({ event, members, onOpenChange, onEdit, onCancelled }: EventDetailDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const day = dateInAppZone(event.startsAt);
  const people = event.attendees.map((id) => members.find((member) => member.id === id)).filter((member): member is AgendaOptionMember => Boolean(member));
  const isLink = event.location ? /^https?:\/\//i.test(event.location) : false;
  const recurrence = describeRRule(event.recurrenceRule);

  function cancel() {
    if (!event.commitmentId) return;
    const id = event.commitmentId;
    startTransition(async () => {
      const result = await cancelCommitmentAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onCancelled();
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <StatusDot tone={COMMITMENT_KIND_TONE[event.kind]} />
            {event.source === "google" ? "Do seu Google Agenda" : event.source === "pauta" ? (event.kind === "entrega" ? "Prazo de pauta" : "Pauta agendada") : COMMITMENT_KIND_LABELS[event.kind]}
            {event.status !== "agendado" ? <Badge variant="muted">{COMMITMENT_STATUS_LABELS[event.status]}</Badge> : null}
            {event.visibility === "privado" ? <Badge variant="outline">Privado</Badge> : null}
          </p>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            <span className="capitalize">{weekdayLong(day)}</span>, {dayMonthShort(day)} · {eventTimeLabel(event)}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          {recurrence ? (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Repetição</dt>
              <Repeat className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
              <dd>{recurrence}</dd>
            </div>
          ) : null}
          {event.location ? (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Local</dt>
              <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
              <dd className="min-w-0 break-words">
                {isLink ? (
                  <a href={event.location} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-4">
                    {event.location}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  event.location
                )}
              </dd>
            </div>
          ) : null}
          <div className="flex items-start gap-2">
            <dt className="sr-only">Participantes</dt>
            <Users className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
            <dd className="min-w-0 space-y-1.5">
              <p className="font-semibold">
                {event.ownerName} <span className="font-normal text-subtle">{event.source === "pauta" ? "· líder" : "· responsável"}</span>
              </p>
              {people.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-center gap-1.5 text-[13px]">
                      <UserAvatar name={person.full_name} src={person.avatar_url} profileId={person.id} className="size-5" />
                      {person.full_name}
                    </li>
                  ))}
                </ul>
              ) : null}
              {event.externalAttendees.length > 0 ? (
                <ul className="space-y-0.5 text-[13px] text-muted-foreground">
                  {event.externalAttendees.map((person, index) => (
                    <li key={`${person.email}-${index}`}>
                      {person.name || person.email}
                      {person.name && person.email ? <span className="text-subtle"> · {person.email}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </dd>
          </div>
          {event.companyName || event.projectName || event.dealId ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[13px]">
              {event.companyId && event.companyName ? (
                <Link href={`/clientes/${event.companyId}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
                  <ClientAvatar name={event.companyName} logoUrl={event.companyLogoUrl} size="sm" />
                  {event.companyName}
                </Link>
              ) : null}
              {event.projectId && event.projectName ? (
                <Link href={`/projetos/${event.projectId}`} className="hover:underline">
                  Projeto: {event.projectName}
                </Link>
              ) : null}
              {event.dealId ? (
                <Link href={`/crm?aba=leads&negocio=${event.dealId}`} className="hover:underline">
                  Abrir negócio no CRM
                </Link>
              ) : null}
            </div>
          ) : null}
          {event.notes ? <p className="whitespace-pre-line border-t border-border pt-3 text-[13px] text-muted-foreground">{event.notes}</p> : null}
          {event.reminderMinutes.length > 0 ? (
            <p className="text-[12px] text-subtle">Lembrete: {event.reminderMinutes.map(reminderLabel).join(", ")}</p>
          ) : null}
        </dl>

        <DialogFooter className="gap-2">
          {event.source === "google" && event.externalUrl ? (
            <Button asChild variant="secondary">
              <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                <Eye aria-hidden />
                Abrir no Google Agenda
              </a>
            </Button>
          ) : null}
          {event.source === "pauta" && event.pautaId ? (
            <Button asChild variant="secondary">
              <Link href={`/minhas-pautas?pauta=${event.pautaId}`}>
                <Eye aria-hidden />
                Abrir pauta
              </Link>
            </Button>
          ) : null}
          {event.canEdit && event.commitmentId ? (
            confirming ? (
              <>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
                  Manter
                </Button>
                <Button onClick={cancel} loading={pending}>
                  <XCircle aria-hidden />
                  {event.recurrenceRule ? "Cancelar toda a série" : "Cancelar compromisso"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setConfirming(true)}>
                  <XCircle aria-hidden />
                  Cancelar
                </Button>
                <Button onClick={() => onEdit(event.commitmentId!)}>
                  <Pencil aria-hidden />
                  Editar
                </Button>
              </>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
