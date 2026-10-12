import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addBusinessDays, holidayCalendar, isBusinessDay, nextBusinessDay, nowInFortaleza } from "@/lib/prospeccao/time";

const calendar = holidayCalendar([
  { date: "2000-01-01", recurring: true },
  { date: "2000-11-02", recurring: true },
  { date: "2000-11-15", recurring: true },
  { date: "2000-11-20", recurring: true },
  { date: "2000-11-21", recurring: true },
  { date: "2000-12-25", recurring: true },
  { date: "2027-03-26", recurring: false },
]);
const none = holidayCalendar([]);

describe("nowInFortaleza", () => {
  it("usa UTC-3, não o fuso do servidor", () => {
    const now = nowInFortaleza(new Date("2026-10-10T02:30:00Z"));
    assert.deepEqual(now, { date: "2026-10-09", year: 2026, month: 10, hour: 23, minute: 30 });
  });

  it("vira o ano à meia-noite de Fortaleza, não à de UTC", () => {
    assert.equal(nowInFortaleza(new Date("2027-01-01T02:59:00Z")).date, "2026-12-31");
    assert.equal(nowInFortaleza(new Date("2027-01-01T03:00:00Z")).date, "2027-01-01");
  });
});

describe("isBusinessDay", () => {
  it("fim de semana não é dia útil", () => {
    assert.equal(isBusinessDay("2026-10-10", none), false);
    assert.equal(isBusinessDay("2026-10-11", none), false);
    assert.equal(isBusinessDay("2026-10-13", none), true);
  });

  it("feriado recorrente vale em qualquer ano", () => {
    assert.equal(isBusinessDay("2026-12-25", calendar), false);
    assert.equal(isBusinessDay("2031-12-25", calendar), false);
  });

  it("feriado móvel vale só na data cadastrada", () => {
    assert.equal(isBusinessDay("2027-03-26", calendar), false);
    assert.equal(isBusinessDay("2026-03-26", calendar), true);
  });
});

describe("ponto facultativo (Pular na prospecção)", () => {
  it("ligado pula o dia; desligado conta como útil", () => {
    const carnaval = { date: "2027-02-08", recurring: false };
    assert.equal(isBusinessDay("2027-02-08", holidayCalendar([{ ...carnaval, skip: true }])), false);
    assert.equal(isBusinessDay("2027-02-08", holidayCalendar([carnaval])), false, "padrão: pula");
    assert.equal(isBusinessDay("2027-02-08", holidayCalendar([{ ...carnaval, skip: false }])), true);
    assert.equal(addBusinessDays("2027-02-05", 1, holidayCalendar([{ ...carnaval, skip: true }, { date: "2027-02-09", recurring: false, skip: true }])), "2027-02-10");
  });
});

describe("addBusinessDays", () => {
  it("dia 0 num dia útil é o próprio dia", () => {
    assert.equal(addBusinessDays("2026-10-13", 0, none), "2026-10-13");
  });

  it("dia 0 no sábado cai na segunda", () => {
    assert.equal(addBusinessDays("2026-10-10", 0, none), "2026-10-12");
  });

  it("conta a partir do dia real, mesmo que não seja útil", () => {
    // Domingo 11/10/2026 + 2 úteis: segunda 12/10 é feriado → terça 13 e quarta 14.
    const withAparecida = holidayCalendar([{ date: "2000-10-12", recurring: true }]);
    assert.equal(addBusinessDays("2026-10-11", 2, withAparecida), "2026-10-14");
    assert.equal(addBusinessDays("2026-10-10", 1, none), "2026-10-12");
  });

  it("pula o fim de semana", () => {
    assert.equal(addBusinessDays("2026-10-16", 1, none), "2026-10-19");
    assert.equal(addBusinessDays("2026-10-15", 5, none), "2026-10-22");
  });

  it("pula feriados seguidos (Finados, 15/11 e Consciência Negra + N. Sra. da Apresentação)", () => {
    // 2026: 02/11 segunda (feriado) → 03/11 é o próximo útil.
    assert.equal(addBusinessDays("2026-10-30", 1, calendar), "2026-11-03");
    // 19/11 quinta; 20/11 sexta e 21/11 sábado são feriados → segunda 23/11.
    assert.equal(addBusinessDays("2026-11-19", 1, calendar), "2026-11-23");
  });

  it("atravessa a virada de mês", () => {
    assert.equal(addBusinessDays("2026-09-29", 3, none), "2026-10-02");
  });

  it("atravessa a virada de ano com Natal e Ano-Novo", () => {
    // 24/12/2026 quinta → 25 feriado, 26–27 fim de semana, 28–31 úteis, 01/01 feriado.
    assert.equal(addBusinessDays("2026-12-24", 1, calendar), "2026-12-28");
    assert.equal(addBusinessDays("2026-12-24", 5, calendar), "2027-01-04");
  });

  it("cadência sazonal 0, 2, 5, 10 a partir de uma sexta", () => {
    const start = "2026-10-09";
    assert.deepEqual(
      [0, 2, 5, 10].map((offset) => addBusinessDays(start, offset, calendar)),
      ["2026-10-09", "2026-10-13", "2026-10-16", "2026-10-23"],
    );
  });

  it("rejeita n negativo ou fracionado", () => {
    assert.throws(() => addBusinessDays("2026-10-13", -1, none), RangeError);
    assert.throws(() => addBusinessDays("2026-10-13", 1.5, none), RangeError);
  });

  it("nextBusinessDay devolve o próprio dia útil", () => {
    assert.equal(nextBusinessDay("2026-10-14", calendar), "2026-10-14");
  });
});
