import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeGoal, missingPct } from "@/lib/goals/finalize";

describe("Finalizar meta", () => {
  it("percentual batida: exige o valor final informado pelo CEO", () => {
    assert.equal(finalizeGoal({ mode: "percentual", rate: 10, target: 100_000, achieved: 90_000, reached: true, enteredCommission: null }).ok, false);
    assert.deepEqual(finalizeGoal({ mode: "percentual", rate: 10, target: 100_000, achieved: 90_000, reached: true, enteredCommission: 9_000 }), {
      ok: true,
      commission: 9_000,
      missingPct: 10,
    });
  });

  it("valor fixo batida: o valor da meta (só confirmação)", () => {
    assert.deepEqual(finalizeGoal({ mode: "valor_fixo", rate: 150_000, target: 10_000, achieved: 10_000, reached: true, enteredCommission: null }), {
      ok: true,
      commission: 150_000,
      missingPct: 0,
    });
  });

  it("não alcançada: sem comissão e mostra quanto faltou", () => {
    const result = finalizeGoal({ mode: "valor_fixo", rate: 150_000, target: 100_000, achieved: 82_000, reached: false, enteredCommission: null });
    assert.deepEqual(result, { ok: true, commission: 0, missingPct: 18 });
  });

  it("por unidade: calculado", () => {
    assert.equal(finalizeGoal({ mode: "por_unidade", rate: 5_000, target: 1_000, achieved: 1_200, reached: true, enteredCommission: null }).ok, true);
  });

  it("faltou: nunca negativo, uma casa", () => {
    assert.equal(missingPct(120, 100), 0);
    assert.equal(missingPct(817, 1000), 18.3);
  });
});
