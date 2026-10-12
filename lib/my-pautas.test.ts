import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bucketMyPautas, mergeOverride } from "@/lib/my-pautas";
import type { PautaUrgency } from "@/lib/pautas";
import type { PautaWithDetails } from "@/types";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const ANDERSON = "a0000000-0000-4000-8000-000000000002";

function pauta(partial: Partial<PautaWithDetails>): PautaWithDetails {
  return {
    id: "p1",
    status: "em_execucao",
    board_column: "em_andamento",
    current_assignee_id: ANNA,
    lead_id: ANDERSON,
    due_date: "2026-10-12",
    source: "manual",
    deal_id: null,
    updated_at: "2026-10-12T10:00:00+00:00",
    ...partial,
  } as PautaWithDetails;
}

const today = (due: string | null): PautaUrgency => (due === "2026-10-12" ? "hoje" : due && due < "2026-10-12" ? "atrasada" : "depois");
const context = { profileId: ANNA, requestDealIds: [], urgency: today };

describe("bucketMyPautas", () => {
  it("com a bola: entra no grupo de prazo", () => {
    const result = bucketMyPautas([pauta({})], context);
    assert.equal(result.hoje.length, 1);
  });

  it("passou adiante para revisão (bola com o Anderson): sai de 'Hoje' e vai para 'Acompanhando'", () => {
    const forwarded = pauta({ status: "revisao_interna", board_column: "revisao", current_assignee_id: ANDERSON });
    const result = bucketMyPautas([forwarded], context);
    assert.equal(result.hoje.length, 0);
    assert.equal(result.acompanhando.length, 1);
    assert.equal(result.acompanhando[0]?.board_column, "revisao");
  });

  it("aprovada vai para Entregues, nunca para atrasadas", () => {
    const result = bucketMyPautas([pauta({ status: "aprovado", board_column: "entregue", due_date: "2026-01-01" })], context);
    assert.equal(result.entregues.length, 1);
    assert.equal(result.atrasadas.length, 0);
  });

  it("sem ninguém com a bola, quem participa age", () => {
    assert.equal(bucketMyPautas([pauta({ current_assignee_id: null })], context).hoje.length, 1);
  });

  it("pedido de direcionamento para mim: a pauta do negócio é minha tarefa", () => {
    const crm = pauta({ source: "crm", deal_id: "d1", current_assignee_id: ANDERSON, due_date: "2026-10-01" });
    assert.equal(bucketMyPautas([crm], { ...context, requestDealIds: ["d1"] }).atrasadas.length, 1);
    assert.equal(bucketMyPautas([crm], context).acompanhando.length, 1);
  });
});

describe("mergeOverride", () => {
  it("edição da tela vale enquanto o servidor não tem versão mais nova", () => {
    const server = pauta({});
    const moved = { ...server, board_column: "revisao" as const };
    assert.equal(mergeOverride(server, moved).board_column, "revisao");
  });

  it("versão mais nova do servidor vence a edição antiga da tela", () => {
    const old = pauta({ board_column: "revisao", updated_at: "2026-10-12T10:00:00+00:00" });
    const fresh = pauta({ status: "aprovado", board_column: "entregue", updated_at: "2026-10-12T11:00:00+00:00" });
    assert.equal(mergeOverride(fresh, old).board_column, "entregue");
  });
});
