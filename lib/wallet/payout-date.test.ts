import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/wallet/payout-date-cases.json";
import { isValidPayday, nextPayday, payoutDateFor } from "@/lib/wallet/payout-date";

/** Os mesmos casos são conferidos contra public.payout_date_for no banco (validação da migração). */
describe("data de pagamento na Carteira", () => {
  for (const item of cases) {
    it(item.name, () => assert.equal(payoutDateFor(item.due, item.payday), item.expected));
  }

  it("dia de pagamento só de 1 a 28", () => {
    assert.ok(isValidPayday(1) && isValidPayday(28));
    assert.ok(!isValidPayday(0) && !isValidPayday(29) && !isValidPayday(10.5));
    assert.throws(() => payoutDateFor("2026-10-01", 31));
  });

  it("próximo dia de pagamento: hoje conta", () => {
    assert.equal(nextPayday("2026-10-10", 10), "2026-10-10");
    assert.equal(nextPayday("2026-10-09", 10), "2026-10-10");
    assert.equal(nextPayday("2026-10-11", 10), "2026-11-10");
    assert.equal(nextPayday("2026-12-20", 10), "2027-01-10");
  });
});
