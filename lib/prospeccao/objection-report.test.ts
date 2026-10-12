import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildObjectionReport, periodStart } from "@/lib/prospeccao/objection-report";

const at = (day: string, time = "10:00") => new Date(`${day}T${time}:00-03:00`).toISOString();
const objections = [
  { id: "preco", shortcut: "/preco", label: "Quanto custa?" },
  { id: "ja", shortcut: "/ja-temos", label: "Já temos quem filme" },
  { id: "imagem", shortcut: "/imagem", label: "E o uso de imagem dos alunos?" },
];

describe("periodStart", () => {
  it("últimos 30 dias, trimestre do calendário e tudo", () => {
    assert.equal(periodStart("30d", "2026-10-12"), "2026-09-13");
    assert.equal(periodStart("trimestre", "2026-10-12"), "2026-10-01");
    assert.equal(periodStart("trimestre", "2026-03-31"), "2026-01-01");
    assert.equal(periodStart("tudo", "2026-10-12"), null);
  });
});

describe("buildObjectionReport", () => {
  const registered = [
    { dealId: "d1", objectionId: "preco", playbookId: "matricula", at: at("2026-10-01") },
    { dealId: "d1", objectionId: "preco", playbookId: "matricula", at: at("2026-10-05") },
    { dealId: "d2", objectionId: "preco", playbookId: "espetaculos", at: at("2026-10-02") },
    { dealId: "d3", objectionId: "ja", playbookId: "matricula", at: at("2026-10-03") },
    { dealId: "d4", objectionId: "preco", playbookId: "matricula", at: at("2026-06-10") },
  ];
  const meetings = [
    { dealId: "d1", at: at("2026-10-06") }, // depois da objeção → conta
    { dealId: "d3", at: at("2026-09-20") }, // antes da objeção → não conta
  ];

  it("ordena por frequência, conta leads distintos e reunião só depois da objeção", () => {
    const report = buildObjectionReport(registered, meetings, objections, "30d", "2026-10-12");
    assert.deepEqual(
      report.map((row) => [row.id, row.total, row.leads, row.leadsWithMeeting, row.conversion]),
      [
        ["preco", 3, 2, 1, 0.5],
        ["ja", 1, 1, 0, 0],
      ],
    );
    assert.deepEqual(report[0]?.byPlaybook, [
      { playbookId: "matricula", total: 2 },
      { playbookId: "espetaculos", total: 1 },
    ]);
  });

  it("o período filtra pelo dia da objeção; objeção nunca registrada não aparece", () => {
    const all = buildObjectionReport(registered, meetings, objections, "tudo", "2026-10-12");
    assert.equal(all[0]?.total, 4);
    assert.equal(all.some((row) => row.id === "imagem"), false);
  });
});
