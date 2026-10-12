import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effortLine, meetingsInWeek, touchesOnDay } from "@/lib/prospeccao/effort";

const at = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`).toISOString();

describe("toques por dia (Fortaleza)", () => {
  it("conta pelo dia de Fortaleza, não UTC, e por pessoa", () => {
    const touches = [
      { at: at("2026-10-13", "23:50"), by: "paulo" }, // 02h50 UTC do dia 14 — ainda é dia 13.
      { at: at("2026-10-14", "00:10"), by: "paulo" },
      { at: at("2026-10-14", "09:00"), by: "clara" },
    ];
    assert.equal(touchesOnDay(touches, "paulo", "2026-10-13"), 1);
    assert.equal(touchesOnDay(touches, "paulo", "2026-10-14"), 1);
    assert.equal(touchesOnDay(touches, null, "2026-10-14"), 2);
  });

  it("toque desfeito não está na lista, então não conta", () => {
    assert.equal(touchesOnDay([], "paulo", "2026-10-14"), 0);
  });
});

describe("reuniões por semana (segunda a domingo, Fortaleza)", () => {
  const meetings = [
    { at: at("2026-10-11", "23:30"), by: "paulo" }, // domingo — semana anterior.
    { at: at("2026-10-12", "00:05"), by: "paulo" }, // segunda — esta semana.
    { at: at("2026-10-18", "23:59"), by: "paulo" }, // domingo — esta semana.
    { at: at("2026-10-19", "08:00"), by: "paulo" }, // segunda seguinte.
  ];

  it("respeita a virada da semana à meia-noite de Fortaleza", () => {
    assert.equal(meetingsInWeek(meetings, "paulo", "2026-10-14"), 2);
    assert.equal(meetingsInWeek(meetings, "paulo", "2026-10-11"), 1);
    assert.equal(meetingsInWeek(meetings, "paulo", "2026-10-19"), 1);
  });
});

describe("linha do Chamar hoje", () => {
  it("mostra os alvos; alvo zero mostra só o número", () => {
    assert.equal(effortLine(12, 20, 3, 5), "12 de 20 toques hoje · 3 de 5 reuniões na semana");
    assert.equal(effortLine(4, 0, 1, 0), "4 toques hoje · 1 reunião na semana");
    assert.equal(effortLine(1, 0, 0, 0), "1 toque hoje · 0 reuniões na semana");
  });
});
