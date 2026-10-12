import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { objectionFollowUp, reactivationDateError } from "@/lib/prospeccao/objection";

describe("objeções", () => {
  it("cada ação do HQ leva ao próximo passo certo", () => {
    assert.equal(objectionFollowUp("registrar"), "nada");
    assert.equal(objectionFollowUp("pedir_data_reativacao"), "pedir_data");
    assert.equal(objectionFollowUp("novo_decisor"), "novo_decisor");
  });

  it("reativação só em data futura", () => {
    assert.equal(reactivationDateError("2026-10-14", "2026-10-13"), null);
    assert.match(reactivationDateError("2026-10-13", "2026-10-13") ?? "", /amanhã/);
    assert.match(reactivationDateError("2026-10-01", "2026-10-13") ?? "", /amanhã/);
    assert.match(reactivationDateError("", "2026-10-13") ?? "", /Escolha/);
  });
});
