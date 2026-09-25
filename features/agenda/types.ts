import type { CommitmentKind, CommitmentStatus, CommitmentVisibility, GoogleSyncStatus } from "@/types";

export const AGENDA_VIEWS = ["mes", "semana", "dia", "agenda"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_VIEW_LABELS: Record<AgendaView, string> = {
  mes: "Mês",
  semana: "Semana",
  dia: "Dia",
  agenda: "Agenda",
};

export interface ExternalAttendee {
  name: string;
  email: string;
}

/** Um bloco do calendário — compromisso (uma ocorrência, se recorrente) ou pauta agendada derivada. */
export interface AgendaEvent {
  key: string;
  source: "commitment" | "pauta";
  commitmentId: string | null;
  pautaId: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  title: string;
  kind: CommitmentKind;
  status: CommitmentStatus;
  /** Compromisso privado de outra pessoa: só "Ocupado", sem detalhes. */
  busyOnly: boolean;
  visibility: CommitmentVisibility;
  ownerId: string;
  ownerName: string;
  attendees: string[];
  externalAttendees: ExternalAttendee[];
  location: string | null;
  notes: string | null;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  projectId: string | null;
  projectName: string | null;
  dealId: string | null;
  recurrenceRule: string | null;
  reminderMinutes: number[];
  canEdit: boolean;
  googleSyncStatus: GoogleSyncStatus;
}

export interface AgendaOptionMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface AgendaFormOptions {
  members: AgendaOptionMember[];
  companies: { id: string; name: string; logo_url: string | null }[];
  projects: { id: string; name: string; company_id: string | null }[];
  deals: { id: string; title: string; company_id: string | null; company_name: string | null }[];
  pautas: { id: string; title: string; project_id: string | null; company_name: string | null; scheduled_at: string | null }[];
}

export interface AgendaConflict {
  profileId: string;
  profileName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: string;
}

/** Linha completa de um compromisso para o formulário de edição. */
export interface CommitmentFormRow {
  id: string;
  ownerId: string;
  title: string;
  kind: CommitmentKind;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  attendees: string[];
  externalAttendees: ExternalAttendee[];
  location: string | null;
  notes: string | null;
  companyId: string | null;
  projectId: string | null;
  dealId: string | null;
  pautaId: string | null;
  reminderMinutes: number[];
  visibility: CommitmentVisibility;
  recurrenceRule: string | null;
}
