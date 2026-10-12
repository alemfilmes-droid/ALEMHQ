/** O que o card mostra sobre a reunião (spec 7.1–7.2). Puro. */

export interface MeetingFacts {
  startsAt: string;
  endsAt: string;
}

/** "marcada" até o fim previsto; depois, "aconteceu?" até alguém registrar o resultado. */
export type MeetingStep = "marcada" | "aconteceu";

export function meetingStep(meeting: MeetingFacts, now: Date): MeetingStep {
  return now.getTime() >= Date.parse(meeting.endsAt) ? "aconteceu" : "marcada";
}

/** Resultado escolhido no card → o que o banco faz. */
export type MeetingAnswer = "sim" | "nao_compareceu" | "reagendar";

export function outcomeOf(answer: MeetingAnswer): { held: boolean } | "reagendar" {
  if (answer === "reagendar") return "reagendar";
  return { held: answer === "sim" };
}
