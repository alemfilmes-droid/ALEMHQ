"use client";

import { CalendarPlus, MapPin } from "lucide-react";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { MEETING_OUTCOME_LABELS } from "@/features/crm/labels";
import type { DealMeetingDetail } from "@/features/crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { UserAvatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format";
import { MEETING_OUTCOME_TONE } from "@/lib/status";
import type { DealWithDetails } from "@/types";

interface MeetingsSectionProps {
  deal: DealWithDetails;
  meetings: DealMeetingDetail[];
  closed: boolean;
}

export function MeetingsSection({ deal, meetings, closed }: MeetingsSectionProps) {
  const flow = useCrmFlow();

  return (
    <div className="space-y-4">
      {!closed ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => flow.scheduleMeeting(deal)}>
          <CalendarPlus aria-hidden />
          Agendar reunião
        </Button>
      ) : null}

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma reunião agendada ainda.</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((meeting) => {
            const pending = meeting.result === null;
            const canRegister = pending && (meeting.attendee_id === flow.currentUserId || flow.canManageAll);
            return (
              <li key={meeting.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <StatusDot tone={meeting.result ? MEETING_OUTCOME_TONE[meeting.result] : "neutral"} />
                    {formatDateTime(meeting.scheduled_at)} · {meeting.duration_minutes} min
                  </p>
                  {pending ? (
                    canRegister ? (
                      <Button type="button" size="sm" onClick={() => flow.registerOutcome(deal, { id: meeting.id, scheduledAt: meeting.scheduled_at })}>
                        Registrar resultado
                      </Button>
                    ) : (
                      <Badge variant="outline">Aguardando resultado</Badge>
                    )
                  ) : (
                    <Badge variant="outline">{MEETING_OUTCOME_LABELS[meeting.result!]}</Badge>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <UserAvatar name={meeting.attendee?.full_name ?? "—"} src={meeting.attendee?.avatar_url ?? null} profileId={meeting.attendee_id} className="size-5" />
                  {meeting.attendee?.full_name ?? "—"}
                </p>
                {meeting.location_or_link ? (
                  <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{meeting.location_or_link}</span>
                  </p>
                ) : null}
                {meeting.result_note ? <p className="mt-2 whitespace-pre-wrap text-sm">{meeting.result_note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
