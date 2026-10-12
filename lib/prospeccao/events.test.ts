import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { onQuoteApproved, quoteApproved, type QuoteApprovedEvent } from "@/lib/prospeccao/events";
import { reactivationDateError } from "@/lib/prospeccao/objection";

describe("orçamento aprovado → quoteApproved", () => {
  it("entrega o evento a quem se registrou, e uma falha não impede os outros", async () => {
    const received: QuoteApprovedEvent[] = [];
    const offOk = onQuoteApproved(async (event) => void received.push(event));
    const offFail = onQuoteApproved(async () => Promise.reject(new Error("meta indisponível")));
    const event = { leadId: "deal-1", quoteId: "budget-1", amount: 18500 };
    assert.equal(await quoteApproved(event), 1);
    assert.deepEqual(received, [event]);
    offOk();
    offFail();
    assert.equal(await quoteApproved(event), 0);
    assert.equal(received.length, 1, "depois de remover, não recebe mais");
  });
});

describe("orçamento recusado → volta ao CRM", () => {
  it("a data de reativação precisa ser futura", () => {
    assert.equal(reactivationDateError("2026-11-11", "2026-10-11"), null);
    assert.match(reactivationDateError("2026-10-11", "2026-10-11") ?? "", /amanhã/);
  });
});
