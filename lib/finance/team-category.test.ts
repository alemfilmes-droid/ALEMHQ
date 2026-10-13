import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/finance/team-category-cases.json";
import { teamBreakdown, teamCategoryRule, type TeamPaymentType } from "@/lib/finance/team-category";
import type { PayableCategory } from "@/types";

/** Os mesmos casos são conferidos contra public.payable_team_rule no banco (validação da migração). */
describe("Equipe e colaboradores: categoria automática", () => {
  for (const item of cases) {
    it(item.name, () => {
      const result = teamCategoryRule({
        category: item.input.category as PayableCategory,
        payeeIsMember: item.input.member,
        isProLabore: item.input.proLabore,
        isReimbursement: item.input.reimbursement,
        teamType: item.input.type as TeamPaymentType | null,
        hasCommissionGoal: item.input.goal,
      });
      assert.deepEqual({ category: result.category, type: result.teamType }, item.expected);
    });
  }

  it("trava a categoria pelo motivo certo", () => {
    const base = { category: "outro" as PayableCategory, payeeIsMember: false, isProLabore: false, isReimbursement: false, teamType: null, hasCommissionGoal: false };
    assert.equal(teamCategoryRule({ ...base, payeeIsMember: true }).lock, "equipe");
    assert.equal(teamCategoryRule({ ...base, isProLabore: true }).lock, "pro_labore");
    assert.equal(teamCategoryRule({ ...base, isReimbursement: true }).lock, "reembolso");
    assert.equal(teamCategoryRule(base).lock, null);
  });
});

describe("relatórios: Equipe e colaboradores por tipo", () => {
  it("soma por tipo, incluindo lançamentos antigos (Comissão e Pró-labore como categoria)", () => {
    assert.deepEqual(
      teamBreakdown([
        { category: "pessoal", teamType: "pro_labore", amount: 3000 },
        { category: "pro_labore", teamType: null, amount: 1000 },
        { category: "comissao", teamType: null, amount: 200 },
        { category: "pessoal", teamType: null, amount: 500 },
        { category: "software", teamType: null, amount: 999 },
      ]),
      [
        { type: "pro_labore", total: 4000 },
        { type: "comissao", total: 200 },
        { type: "pagamento_colaborador", total: 500 },
      ],
    );
  });
});
