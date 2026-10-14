import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/projects/board-cases.json";
import { boardColumnOf, checkMove, isActiveProject, stageAfterMove } from "@/lib/projects/board";
import { ALL_PROJECT_STAGES } from "@/lib/domain";
import type { ProjectStage } from "@/types";

/** Os mesmos casos são conferidos contra public.project_board_column no banco (validação da migração). */
describe("quadro de Projetos: Ativos, Encerrados, Churn", () => {
  for (const item of cases) {
    it(`${item.stage} → ${item.column}`, () => assert.equal(boardColumnOf(item.stage as ProjectStage), item.column));
  }

  it("toda etapa tem coluna (inclusive as novas)", () => {
    for (const stage of ALL_PROJECT_STAGES) assert.ok(cases.some((item) => item.stage === stage), stage);
  });

  it("Somente ativos: tira encerrados, cancelados e churn", () => {
    assert.equal(isActiveProject("captacao"), true);
    assert.equal(isActiveProject("entregue"), true);
    assert.equal(isActiveProject("encerrado"), false);
    assert.equal(isActiveProject("cancelado"), false);
    assert.equal(isActiveProject("churn"), false);
  });

  it("mover para Churn exige motivo", () => {
    assert.deepEqual(checkMove("edicao", "churn"), { kind: "needs_reason" });
    assert.deepEqual(checkMove("edicao", "churn", { reason: "  " }), { kind: "needs_reason" });
    assert.deepEqual(checkMove("edicao", "churn", { reason: "Cliente cortou o orçamento" }), { kind: "ok" });
  });

  it("mover para Encerrado pede confirmação", () => {
    assert.deepEqual(checkMove("entregue", "encerrados"), { kind: "needs_confirmation" });
    assert.deepEqual(checkMove("entregue", "encerrados", { confirmed: true }), { kind: "ok" });
  });

  it("mesma coluna não faz nada; voltar para Ativos é direto", () => {
    assert.deepEqual(checkMove("cancelado", "encerrados", { confirmed: true }), { kind: "noop" });
    assert.deepEqual(checkMove("churn", "ativos"), { kind: "ok" });
  });

  it("voltar para Ativos devolve a etapa de antes", () => {
    assert.equal(stageAfterMove("ativos", "edicao"), "edicao");
    assert.equal(stageAfterMove("ativos", null), "pre_producao");
    assert.equal(stageAfterMove("churn", "edicao"), "churn");
    assert.equal(stageAfterMove("encerrados", "edicao"), "encerrado");
  });
});
