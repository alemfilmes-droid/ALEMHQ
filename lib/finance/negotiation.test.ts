import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNegotiation, type BudgetCandidate, type DealCandidate } from "@/lib/finance/negotiation";

function budget(overrides: Partial<BudgetCandidate>): BudgetCandidate {
  return {
    id: "b1",
    number: 1,
    version: 1,
    status: "enviado",
    dealId: null,
    companyId: "c1",
    clientName: "Cliente",
    title: "Projeto",
    totalCents: 100_000,
    probability: null,
    updatedAt: "2026-10-10T12:00:00Z",
    ...overrides,
  };
}

function deal(overrides: Partial<DealCandidate>): DealCandidate {
  return {
    id: "d1",
    code: "N-001",
    companyId: "c1",
    clientName: "Cliente",
    title: "Negócio",
    status: "enviada",
    stage: "proposta_enviada",
    amountCents: 50_000,
    probability: 0.5,
    updatedAt: "2026-10-09T12:00:00Z",
    ...overrides,
  };
}

describe("Em negociação", () => {
  it("conta Enviado, Em análise e Em ajuste; Rascunho, Não aprovado e Aprovado ficam de fora", () => {
    const summary = buildNegotiation(
      [
        budget({ id: "a", number: 1, status: "enviado", totalCents: 100 }),
        budget({ id: "b", number: 2, status: "em_analise", totalCents: 200 }),
        budget({ id: "c", number: 3, status: "em_ajuste", totalCents: 400 }),
        budget({ id: "d", number: 4, status: "rascunho", totalCents: 800 }),
        budget({ id: "e", number: 5, status: "recusado", totalCents: 1_600 }),
        budget({ id: "f", number: 6, status: "aprovado", totalCents: 3_200 }),
      ],
      [],
    );
    assert.deepEqual(summary.entries.map((entry) => entry.id).sort(), ["a", "b", "c"]);
    assert.equal(summary.totalCents, 700);
    assert.equal(summary.byOrigin.orcamento.count, 3);
  });

  it("sem soma dupla: negócio com orçamento ligado conta só o orçamento", () => {
    const summary = buildNegotiation(
      [budget({ id: "b1", dealId: "d1", totalCents: 120_000, probability: 0.5 })],
      [deal({ id: "d1", amountCents: 120_000 }), deal({ id: "d2", code: "N-002", amountCents: 30_000, probability: 0.2 })],
    );
    assert.deepEqual(
      summary.entries.map((entry) => entry.key),
      ["orcamento:b1", "crm:d2"],
    );
    assert.equal(summary.totalCents, 150_000);
    assert.deepEqual(summary.byOrigin, { crm: { count: 1, totalCents: 30_000 }, orcamento: { count: 1, totalCents: 120_000 } });
    // Ponderada: orçamento ligado usa a probabilidade da etapa do negócio.
    assert.equal(summary.weightedCents, 60_000 + 6_000);
  });

  it("negócio ligado a orçamento recusado não volta a contar", () => {
    const summary = buildNegotiation([budget({ dealId: "d1", status: "recusado" })], [deal({ id: "d1" })]);
    assert.equal(summary.count, 0);
    assert.equal(summary.totalCents, 0);
  });

  it("versões: vale a última que saiu do rascunho", () => {
    const sentV2 = buildNegotiation(
      [budget({ id: "v1", number: 9, version: 1, status: "em_ajuste", totalCents: 100_000 }), budget({ id: "v2", number: 9, version: 2, status: "enviado", totalCents: 90_000 })],
      [],
    );
    assert.deepEqual(sentV2.entries.map((entry) => entry.id), ["v2"]);
    assert.equal(sentV2.totalCents, 90_000);

    const draftV2 = buildNegotiation(
      [budget({ id: "v1", number: 9, version: 1, status: "em_ajuste", totalCents: 100_000 }), budget({ id: "v2", number: 9, version: 2, status: "rascunho", totalCents: 90_000 })],
      [],
    );
    assert.deepEqual(draftV2.entries.map((entry) => entry.id), ["v1"]);

    const rejectedV2 = buildNegotiation(
      [budget({ id: "v1", number: 9, version: 1, status: "em_ajuste" }), budget({ id: "v2", number: 9, version: 2, status: "recusado" })],
      [],
    );
    assert.equal(rejectedV2.count, 0);
  });

  it("orçamento fora do CRM fica sem ponderada; itens trazem origem e link", () => {
    const summary = buildNegotiation([budget({ id: "b9", number: 12, version: 2 })], [deal({ id: "d7" })]);
    const byKey = new Map(summary.entries.map((entry) => [entry.key, entry]));
    assert.equal(byKey.get("orcamento:b9")?.weightedCents, null);
    assert.equal(byKey.get("orcamento:b9")?.label, "Orçamento 0012 v2");
    assert.equal(byKey.get("orcamento:b9")?.href, "/orcamentos/b9");
    assert.equal(byKey.get("crm:d7")?.href, "/crm?aba=leads&negocio=d7");
    assert.equal(summary.weightedCents, 25_000);
  });
});
