import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_PROJECT_STAGES } from "@/lib/domain";
import { PROJECT_MODEL_TINT, PROJECT_STAGE_FAMILY, PROJECT_STATUS_TINT, clientModelOf } from "@/lib/projects/colors";
import { TINTS } from "@/lib/theme/tint";

describe("cores de Projetos (fonte única)", () => {
  it("toda etapa tem uma cor", () => {
    for (const stage of ALL_PROJECT_STAGES) assert.ok(PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY[stage]], stage);
  });

  it("modelos e etapas nas cores pedidas", () => {
    assert.equal(PROJECT_MODEL_TINT.recorrente, TINTS.violetIndigo);
    assert.equal(PROJECT_MODEL_TINT.transacional, TINTS.tealCyan);
    assert.equal(PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY.pre_producao], TINTS.blue);
    assert.equal(PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY.captacao], TINTS.amber);
    assert.equal(PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY.edicao], TINTS.purple);
    assert.equal(PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY.aprovacao_cliente], TINTS.yellow);
    assert.equal(PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY.encerrado], TINTS.gray);
  });

  it("modelo do cliente pelo que está em aberto", () => {
    assert.equal(clientModelOf([]), null);
    assert.equal(clientModelOf([{ model: "transacional", stage: "captacao" }, { model: "recorrente", stage: "edicao" }]), "recorrente");
    assert.equal(clientModelOf([{ model: "transacional", stage: "captacao" }, { model: "recorrente", stage: "encerrado" }]), "transacional");
  });
});
