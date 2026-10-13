import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWallet, paidInMonth, walletKindOf, type Remuneration, type WalletEntry } from "@/lib/wallet/wallet";

const entry = (overrides: Partial<WalletEntry>): WalletEntry => ({
  id: "e1",
  description: "Comissão",
  amountCents: 10_000,
  dueDate: "2026-10-05",
  payoutDate: "2026-10-10",
  paidAt: null,
  companyName: null,
  projectName: null,
  goalTitle: null,
  teamType: null,
  category: "pessoal",
  isFixed: false,
  hasGoal: false,
  hasProject: false,
  ...overrides,
});

const fixed: Remuneration = { type: "fixo_mais_variavel", fixedAmountCents: 300_000, payday: 10, defaultCommissionPercent: 5 };

describe("Carteira", () => {
  it("tipo de cada linha", () => {
    assert.equal(walletKindOf({ teamType: "comissao", category: "pessoal", isFixed: false, hasGoal: true, hasProject: false }), "bonus_meta");
    assert.equal(walletKindOf({ teamType: "comissao", category: "pessoal", isFixed: false, hasGoal: false, hasProject: false }), "comissao");
    assert.equal(walletKindOf({ teamType: "pro_labore", category: "pessoal", isFixed: true, hasGoal: false, hasProject: false }), "pro_labore");
    assert.equal(walletKindOf({ teamType: "pagamento_colaborador", category: "pessoal", isFixed: true, hasGoal: false, hasProject: false }), "salario_fixo");
    assert.equal(walletKindOf({ teamType: "pagamento_colaborador", category: "pessoal", isFixed: false, hasGoal: false, hasProject: true }), "cache_job");
    assert.equal(walletKindOf({ teamType: null, category: "outro", isFixed: false, hasGoal: false, hasProject: false }), "outro");
  });

  it("agrupa o que falta receber por data e mostra o próximo pagamento", () => {
    const view = buildWallet(
      [
        entry({ id: "a", payoutDate: "2026-11-10", amountCents: 5_000 }),
        entry({ id: "b", payoutDate: "2026-10-10", amountCents: 7_000 }),
        entry({ id: "c", payoutDate: "2026-10-10", amountCents: 3_000 }),
        entry({ id: "d", payoutDate: "2026-09-10", paidAt: "2026-09-10" }),
      ],
      null,
      "2026-10-01",
    );
    assert.deepEqual(view.toReceive.map((group) => [group.date, group.totalCents]), [["2026-10-10", 10_000], ["2026-11-10", 5_000]]);
    assert.deepEqual(view.next, { date: "2026-10-10", totalCents: 10_000 });
    assert.deepEqual(view.paid.map((line) => line.id), ["d"]);
  });

  it("fixo aparece sozinho no próximo dia de pagamento, somado ao resto", () => {
    const view = buildWallet([entry({ payoutDate: "2026-10-10", amountCents: 2_000 })], fixed, "2026-10-01");
    assert.deepEqual(view.next, { date: "2026-10-10", totalCents: 302_000 });
    assert.ok(view.toReceive[0]?.lines.some((line) => line.virtual && line.kind === "salario_fixo"));
  });

  it("fixo já lançado no Financeiro não aparece duas vezes", () => {
    const view = buildWallet([entry({ isFixed: true, teamType: "pagamento_colaborador", payoutDate: "2026-10-10", amountCents: 300_000 })], fixed, "2026-10-01");
    assert.equal(view.toReceive[0]?.lines.length, 1);
    assert.equal(view.toReceive[0]?.lines[0]?.virtual, false);
  });

  it("só comissão ou por job: sem linha de fixo", () => {
    assert.equal(buildWallet([], { ...fixed, type: "so_comissao" }, "2026-10-01").next, null);
    assert.equal(buildWallet([], { ...fixed, type: "por_job" }, "2026-10-01").next, null);
  });

  it("depois do dia de pagamento, o fixo vai para o mês seguinte", () => {
    assert.deepEqual(buildWallet([], fixed, "2026-10-11").next, { date: "2026-11-10", totalCents: 300_000 });
  });

  it("histórico filtrado por mês", () => {
    const view = buildWallet([entry({ id: "x", paidAt: "2026-09-10" }), entry({ id: "y", paidAt: "2026-10-10" })], null, "2026-10-20");
    assert.deepEqual(paidInMonth(view.paid, "2026-09").map((line) => line.id), ["x"]);
  });
});
