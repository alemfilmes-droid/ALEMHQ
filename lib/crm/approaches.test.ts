import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cadenceStatus } from "@/features/crm/cadence";
import type { DealInteractionDetail } from "@/features/crm/types";
import { activeOnly, canChangeApproach, canOpenStruckDetails } from "@/lib/crm/approaches";

const PAULO = { id: "paulo", isCeo: false };
const ANDERSON = { id: "anderson", isCeo: true };
const OUTRO = { id: "outro", isCeo: false };

describe("quem edita e risca abordagens", () => {
  const attempt = { kind: "tentativa_contato" as const, author_id: "paulo", deleted_at: null };

  it("o autor e a diretoria editam; outra pessoa não", () => {
    assert.equal(canChangeApproach(attempt, PAULO), true);
    assert.equal(canChangeApproach(attempt, ANDERSON), true);
    assert.equal(canChangeApproach(attempt, OUTRO), false);
  });

  it("riscado não se edita de novo; nota/direcionamento não são abordagens", () => {
    assert.equal(canChangeApproach({ ...attempt, deleted_at: "2026-10-15T10:00:00Z" }, ANDERSON), false);
    assert.equal(canChangeApproach({ ...attempt, kind: "direcionamento" }, ANDERSON), false);
  });

  it("só a diretoria abre o motivo do risco", () => {
    const struck = { ...attempt, deleted_at: "2026-10-15T10:00:00Z" };
    assert.equal(canOpenStruckDetails(struck, ANDERSON), true);
    assert.equal(canOpenStruckDetails(struck, PAULO), false);
    assert.equal(canOpenStruckDetails(attempt, ANDERSON), false);
  });
});

function interaction(id: string, occurredAt: string, deleted = false): DealInteractionDetail {
  return {
    id,
    deal_id: "d1",
    kind: "tentativa_contato",
    channel: "whatsapp",
    approach: null,
    body: "oi",
    summary: "oi",
    next_step: null,
    responded: false,
    responded_to_interaction_id: null,
    stage: "tentativas_contato",
    stage_to: null,
    author_id: "paulo",
    author: null,
    occurred_at: occurredAt,
    created_at: occurredAt,
    edited_at: null,
    deleted_at: deleted ? "2026-10-15T12:00:00Z" : null,
  };
}

describe("riscados saem das contagens", () => {
  it("tentativa riscada não conta na sequência sem resposta", () => {
    const list = [interaction("a", "2026-10-13T13:00:00Z"), interaction("b", "2026-10-14T13:00:00Z"), interaction("c", "2026-10-15T13:00:00Z", true)];
    assert.equal(cadenceStatus(activeOnly(list)).streak, 2);
    assert.equal(cadenceStatus(list).streak, 2);
  });
});
