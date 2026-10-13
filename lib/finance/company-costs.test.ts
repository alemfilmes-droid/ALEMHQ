import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { costGroupOf, isCompanyCost, summarizeCompanyCosts, type CompanyCostInput } from "@/lib/finance/company-costs";

const line = (overrides: Partial<CompanyCostInput>): CompanyCostInput => ({
  category: "software",
  teamType: null,
  costScope: "empresa",
  isFixed: true,
  amount: 10_000,
  dueDate: "2026-10-05",
  ...overrides,
});

describe("Custos da empresa: cada cartão soma só o que é dele", () => {
  it("pró-labore vai para o cartão Pró-labore (sócios), nunca para Equipe", () => {
    assert.equal(costGroupOf({ category: "pessoal", teamType: "pro_labore" }), "pro_labore");
    assert.equal(costGroupOf({ category: "pro_labore", teamType: null }), "pro_labore");
    assert.equal(costGroupOf({ category: "pessoal", teamType: "pagamento_colaborador" }), "equipe");
    assert.equal(costGroupOf({ category: "pessoal", teamType: "comissao" }), "equipe");
  });

  it("pró-labore ligado a projeto entra (sócios); outros custos de projeto não", () => {
    assert.equal(isCompanyCost({ category: "pessoal", teamType: "pro_labore", costScope: "projeto" }), true);
    assert.equal(isCompanyCost({ category: "pessoal", teamType: "pagamento_colaborador", costScope: "projeto" }), false);
    assert.equal(isCompanyCost({ category: "freelancer", teamType: null, costScope: "projeto" }), false);
  });

  it("outubro: pró-labore de projeto no cartão certo, Equipe só com colaboradores, totais batem", () => {
    const summary = summarizeCompanyCosts(
      [
        // Pró-labore do sócio ligado a um projeto de cliente (ex.: captação mensal) e um sem projeto.
        line({ category: "pessoal", teamType: "pro_labore", costScope: "projeto", amount: 200_000, isFixed: true }),
        line({ category: "pessoal", teamType: "pro_labore", costScope: "empresa", amount: 50_000, isFixed: false }),
        line({ category: "pessoal", teamType: "pagamento_colaborador", amount: 300_000, isFixed: true }),
        line({ category: "pessoal", teamType: "comissao", amount: 20_000, isFixed: false }),
        line({ category: "software", amount: 4_600 }),
        // Custo de projeto (fora) e de outro mês (fora).
        line({ category: "freelancer", costScope: "projeto", amount: 99_999 }),
        line({ category: "software", amount: 7_777, dueDate: "2026-09-30" }),
      ],
      "2026-10",
      1_000_000,
    );
    const group = (name: string) => summary.groups.find((item) => item.group === name)!;

    assert.equal(group("pro_labore").total, 250_000);
    assert.equal(group("pro_labore").linkedToProjects, 200_000);
    assert.equal(group("equipe").total, 320_000);
    assert.deepEqual(group("equipe").teamBreakdown.map((item) => item.type), ["comissao", "pagamento_colaborador"]);
    assert.equal(group("software").total, 4_600);

    assert.equal(summary.total, 574_600);
    assert.equal(summary.total, summary.groups.reduce((total, item) => total + item.total, 0));
    assert.equal(summary.fixed, 504_600);
    assert.equal(summary.variable, 70_000);
    assert.equal(summary.fixedShare, 50.5);
  });

  it("sem faturamento: % do faturamento fica vazio", () => {
    assert.equal(summarizeCompanyCosts([line({})], "2026-10", 0).fixedShare, null);
  });
});
