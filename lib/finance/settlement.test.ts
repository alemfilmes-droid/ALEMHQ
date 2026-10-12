import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSettleKey, resolveSettleConflict, settleDbErrorMessage } from "@/lib/finance/settlement";

const KEY = "6f1c2a7e-1d2b-4c3d-9e8f-0a1b2c3d4e5f";
const OTHER = "11111111-2222-4333-8444-555555555555";

describe("resolveSettleConflict", () => {
  it("a mesma tentativa repetida é sucesso, não erro (idempotente)", () => {
    const result = resolveSettleConflict({ settledOn: "2026-10-12", cancelledAt: null, settleKey: KEY }, KEY, "pagamento");
    assert.deepEqual(result, { ok: true, message: "Pagamento registrado." });
  });

  it("baixa já feita por outra tentativa não gera segunda baixa", () => {
    const result = resolveSettleConflict({ settledOn: "2026-10-10", cancelledAt: null, settleKey: OTHER }, KEY, "pagamento");
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /já tinha baixa em 10\/10\/2026/);
  });

  it("baixa antiga (sem chave) também é reconhecida", () => {
    const result = resolveSettleConflict({ settledOn: "2026-09-01", cancelledAt: null, settleKey: null }, KEY, "recebimento");
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /Este recebimento já tinha baixa em 01\/09\/2026/);
  });

  it("item cancelado", () => {
    const result = resolveSettleConflict({ settledOn: null, cancelledAt: "2026-10-01T10:00:00Z", settleKey: null }, KEY, "pagamento");
    assert.match(!result.ok ? result.error : "", /cancelado/);
  });

  it("item invisível (RLS) ou inexistente", () => {
    assert.equal(resolveSettleConflict(null, KEY, "pagamento").ok, false);
  });
});

describe("settleDbErrorMessage", () => {
  it("regra do banco passa direto", () => {
    assert.equal(settleDbErrorMessage({ code: "22023", message: "Pagamento depois do vencimento: informe o motivo do atraso." }, "pagamento"), "Pagamento depois do vencimento: informe o motivo do atraso.");
  });
  it("erro técnico não vaza", () => {
    assert.match(settleDbErrorMessage({ code: "XX000", message: "internal" }, "recebimento"), /Não foi possível registrar o recebimento/);
  });
});

describe("isSettleKey", () => {
  it("aceita só uuid", () => {
    assert.equal(isSettleKey(KEY), true);
    assert.equal(isSettleKey("abc"), false);
    assert.equal(isSettleKey(undefined), false);
  });
});
