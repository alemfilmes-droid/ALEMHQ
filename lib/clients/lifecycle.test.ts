import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMoneyToCents } from "@/features/finance/money";
import { financePlan, inactiveStatusOf, isLastActiveProject, manualEntryError } from "@/lib/clients/lifecycle";

describe("status do cliente inativo", () => {
  it("churn, pausa e os motivos de encerramento", () => {
    assert.equal(inactiveStatusOf("churn"), "churn");
    assert.equal(inactiveStatusOf("pausa_temporaria"), "pausado");
    assert.equal(inactiveStatusOf("fim_de_contrato"), "encerrado");
    assert.equal(inactiveStatusOf("projeto_concluido"), "encerrado");
    assert.equal(inactiveStatusOf("outro"), "encerrado");
  });
});

describe("encerramento: lançamentos em aberto", () => {
  const open = [
    { id: "a", amount: 100 },
    { id: "b", amount: 200 },
    { id: "c", amount: 300 },
  ];

  it("Sim: os marcados continuam e os demais são cancelados", () => {
    const plan = financePlan(open, "sim", ["b"]);
    assert.deepEqual(plan.kept.map((entry) => entry.id), ["b"]);
    assert.deepEqual(plan.cancelled.map((entry) => entry.id), ["a", "c"]);
    assert.equal(plan.cancelledTotal, 400);
  });

  it("Não: todos os em aberto serão cancelados (pede confirmação)", () => {
    const plan = financePlan(open, "nao", ["b"]);
    assert.equal(plan.kept.length, 0);
    assert.equal(plan.cancelled.length, 3);
    assert.equal(plan.cancelledTotal, 600);
  });
});

describe("lançamento manual do encerramento", () => {
  it("exige descrição, valor > 0, vencimento e (custos) favorecido", () => {
    assert.equal(manualEntryError({ description: "Multa", amount: "500,00", dueDate: "2026-11-10" }, "receivable", parseMoneyToCents), null);
    assert.match(manualEntryError({ description: "Multa", amount: "0", dueDate: "2026-11-10" }, "receivable", parseMoneyToCents) ?? "", /maior que zero/);
    assert.match(manualEntryError({ description: "Diária", amount: "150", dueDate: "2026-10-20" }, "payable", parseMoneyToCents) ?? "", /favorecido/);
    assert.match(manualEntryError({ description: "x", amount: "10", dueDate: "" }, "receivable", parseMoneyToCents) ?? "", /descrição/);
  });
});

describe("último projeto do cliente", () => {
  it("pergunta só quando não sobra outro projeto ativo", () => {
    assert.equal(isLastActiveProject("p1", ["p1"]), true);
    assert.equal(isLastActiveProject("p1", []), true);
    assert.equal(isLastActiveProject("p1", ["p1", "p2"]), false);
  });
});
