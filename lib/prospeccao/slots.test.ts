import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meetingStep, outcomeOf } from "@/lib/prospeccao/meeting";
import { formatSlot, freeSlots, insideWindows, isFree, suggestSlots, type Interval, type SlotRules } from "@/lib/prospeccao/slots";
import { holidayCalendar } from "@/lib/prospeccao/time";

const at = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`).toISOString();
const block = (day: string, from: string, to: string): Interval => ({ start: at(day, from), end: at(day, to) });

const rules: SlotRules = {
  durationMinutes: 45,
  windows: [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "17:00" },
  ],
  calendar: holidayCalendar([{ date: "2000-11-02", recurring: true }, { date: "2000-11-20", recurring: true }]),
};

describe("freeSlots", () => {
  it("blocos de 45 min dentro das janelas, de 30 em 30", () => {
    const slots = freeSlots(new Date(at("2026-10-13", "06:00")), [], rules).filter((slot) => slot.start.startsWith("2026-10-13"));
    // 9:00, 9:30, 10:00, 10:30, 11:00 (11:15 terminaria às 12:00, mas o passo é 30) + 14:00 … 16:00.
    assert.equal(slots.length, 10);
    assert.equal(slots[0]?.start, at("2026-10-13", "09:00"));
    assert.equal(slots[0]?.end, at("2026-10-13", "09:45"));
    assert.ok(slots.every((slot) => insideWindows(slot, rules)));
  });

  it("começa no mínimo 2 horas depois de agora", () => {
    // 8h40 + 2h = 10h40 → 11h (último começo da manhã que cabe até 12h).
    assert.equal(freeSlots(new Date(at("2026-10-13", "08:40")), [], rules)[0]?.start, at("2026-10-13", "11:00"));
    // 9h10 + 2h = 11h10 → 11h30 passaria das 12h → 14h.
    assert.equal(freeSlots(new Date(at("2026-10-13", "09:10")), [], rules)[0]?.start, at("2026-10-13", "14:00"));
  });

  it("pula fim de semana e feriado", () => {
    // Sexta 30/10 às 16h → sáb, dom, seg 02/11 (Finados) → ter 03/11 às 9h.
    const [first] = freeSlots(new Date(at("2026-10-30", "16:00")), [], rules);
    assert.equal(first?.start, at("2026-11-03", "09:00"));
  });

  it("respeita os horários ocupados (inclusive parcialmente)", () => {
    const busy = [block("2026-10-14", "08:00", "09:40"), block("2026-10-14", "10:20", "10:50")];
    const [first, second] = freeSlots(new Date(at("2026-10-13", "20:00")), busy, rules);
    // 9:00 e 9:30 batem no primeiro bloco; 10:00 bate no segundo (até 10:45); 11:00 está livre.
    assert.equal(first?.start, at("2026-10-14", "11:00"));
    assert.equal(second?.start, at("2026-10-14", "14:00"));
  });

  it("procura só 10 dias úteis e devolve vazio se tudo estiver ocupado", () => {
    const allBusy = [{ start: at("2026-10-13", "00:00"), end: at("2026-11-30", "23:59") }];
    assert.deepEqual(freeSlots(new Date(at("2026-10-13", "06:00")), allBusy, rules), []);
    assert.deepEqual(suggestSlots(new Date(at("2026-10-13", "06:00")), allBusy, rules), []);
    const slots = freeSlots(new Date(at("2026-10-13", "06:00")), [], rules);
    assert.ok((slots.at(-1)?.start ?? "") < at("2026-10-28", "00:00"));
  });
});

describe("suggestSlots", () => {
  it("prefere dois dias diferentes", () => {
    const [first, second] = suggestSlots(new Date(at("2026-10-13", "06:00")), [], rules);
    assert.equal(first?.start, at("2026-10-13", "09:00"));
    assert.equal(second?.start, at("2026-10-14", "09:00"));
  });

  it("se só sobrar um dia, oferece dois horários nele", () => {
    const busy = [{ start: at("2026-10-14", "00:00"), end: at("2026-12-31", "00:00") }];
    const [first, second] = suggestSlots(new Date(at("2026-10-13", "06:00")), busy, rules);
    assert.equal(first?.start, at("2026-10-13", "09:00"));
    assert.equal(second?.start, at("2026-10-13", "09:30"));
  });
});

describe("conferência antes de criar (horário duplicado)", () => {
  it("horário tomado entre a sugestão e a confirmação é detectado", () => {
    const slot = block("2026-10-14", "09:00", "09:45");
    assert.equal(isFree(slot, []), true);
    assert.equal(isFree(slot, [block("2026-10-14", "09:30", "10:00")]), false);
    assert.equal(isFree(slot, [block("2026-10-14", "09:45", "10:30")]), true, "encostar no fim não conflita");
  });

  it("outro horário fora das janelas ou em feriado é avisado", () => {
    assert.equal(insideWindows(block("2026-10-14", "12:00", "12:45"), rules), false);
    assert.equal(insideWindows(block("2026-11-02", "09:00", "09:45"), rules), false);
    assert.equal(insideWindows(block("2026-10-14", "11:15", "12:00"), rules), true);
  });
});

describe("formatSlot", () => {
  it("dia da semana, data e hora em português", () => {
    assert.equal(formatSlot(at("2026-10-14", "09:00")), "quarta (14/10) às 9h");
    assert.equal(formatSlot(at("2026-10-15", "14:30")), "quinta (15/10) às 14h30");
  });
});

describe("reunião no card", () => {
  it("marcada até o fim; depois pergunta se aconteceu", () => {
    const meeting = { startsAt: at("2026-10-14", "09:00"), endsAt: at("2026-10-14", "09:45") };
    assert.equal(meetingStep(meeting, new Date(at("2026-10-14", "09:30"))), "marcada");
    assert.equal(meetingStep(meeting, new Date(at("2026-10-14", "09:45"))), "aconteceu");
  });

  it("cada resposta vira a ação certa", () => {
    assert.deepEqual(outcomeOf("sim"), { held: true });
    assert.deepEqual(outcomeOf("nao_compareceu"), { held: false });
    assert.equal(outcomeOf("reagendar"), "reagendar");
  });
});
