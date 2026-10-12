/**
 * "Marcar reunião" pede quem atende (Bloco 5): o Anderson ou o SDR (kick-off). Quem atende fica com a
 * bola em "Reunião agendada" (o banco faz isso pelo attendee_id) e é de quem saem os horários livres e
 * o evento. Com o SDR, nada chega ao Anderson: horários da agenda do HQ do SDR (e do Google dele, só
 * se estiver conectado), evento na agenda dele.
 */

export const MEETING_HOST_CHOICES = ["anderson", "sdr"] as const;
export type MeetingHostChoice = (typeof MEETING_HOST_CHOICES)[number];

export interface MeetingPeople {
  /** CEO (conta master). */
  ceoId: string | null;
  /** SDR dono do lead. */
  ownerId: string;
}

/** Quem atende (e fica com a bola) para a escolha feita. */
export function meetingAttendee(choice: MeetingHostChoice, people: MeetingPeople): string | null {
  return choice === "anderson" ? people.ceoId : people.ownerId;
}

/** De onde saem os horários ocupados: sempre a agenda do HQ; o Google só quando conectado. */
export function busySourcesFor(googleConnected: boolean): ("hq" | "google")[] {
  return googleConnected ? ["google", "hq"] : ["hq"];
}

/** Reagendar mantém quem atende: descobre a escolha pela reunião existente. */
export function hostChoiceOf(attendeeId: string, ceoId: string | null): MeetingHostChoice {
  return attendeeId === ceoId ? "anderson" : "sdr";
}

/** Rótulo do botão de escolha ("Reunião com Paulo (kick-off)"). */
export function hostChoiceLabel(choice: MeetingHostChoice, names: { ceo: string; sdr: string }): string {
  const first = (name: string) => name.trim().split(/\s+/)[0] || name;
  return choice === "anderson" ? `Reunião com ${first(names.ceo)}` : `Reunião com ${first(names.sdr)} (kick-off)`;
}
