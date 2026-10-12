import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { columnForStatus, defaultStatusForColumn, statusesForSquad } from "@/lib/pautas";
import type { PautaColumn, PautaStatus, Squad } from "@/types";

/**
 * Mapa etapa → quadro tirado do banco de produção em 12/10/2026
 * (pauta_column_for_status sobre pauta_statuses_for de cada squad). A tela precisa espelhar igual,
 * senão a pauta encaminhada aparece num quadro na tela e noutro no banco.
 */
const DB_MAP: Record<Squad, Record<string, PautaColumn>> = {
  diretoria: { planejamento: "sprint_backlog", em_execucao: "em_andamento", em_analise: "em_andamento", revisao_interna: "revisao", revisao_cliente: "revisao", reajuste: "em_andamento", aprovado: "entregue" },
  audiovisual: { planejamento: "sprint_backlog", captacao: "em_andamento", edicao: "em_andamento", revisao_interna: "revisao", revisao_cliente: "revisao", reajuste: "em_andamento", aprovado: "entregue" },
  comercial: { planejamento: "sprint_backlog", em_execucao: "em_andamento", aguardando_retorno: "em_andamento", revisao_interna: "revisao", revisao_cliente: "revisao", reajuste: "em_andamento", aprovado: "entregue" },
  financeiro: { planejamento: "sprint_backlog", em_execucao: "em_andamento", aguardando_documento: "em_andamento", revisao_interna: "revisao", revisao_cliente: "revisao", reajuste: "em_andamento", aprovado: "entregue" },
};

describe("etapa → quadro (espelho do banco)", () => {
  for (const [squad, map] of Object.entries(DB_MAP) as [Squad, Record<string, PautaColumn>][]) {
    it(`squad ${squad}: mesmas etapas e mesmo quadro do banco`, () => {
      assert.deepEqual([...statusesForSquad(squad)], Object.keys(map));
      for (const [status, column] of Object.entries(map)) assert.equal(columnForStatus(status as PautaStatus), column, `${squad}/${status}`);
    });
  }

  it("encaminhar para Conferência (financeiro) leva a pauta para o quadro Revisão", () => {
    assert.equal(columnForStatus("revisao_interna"), "revisao");
  });

  it("arrastar para Revisão sugere a revisão interna em qualquer squad", () => {
    for (const squad of Object.keys(DB_MAP) as Squad[]) assert.equal(defaultStatusForColumn("revisao", "em_execucao", squad), "revisao_interna");
  });
});
