import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NETWORK_MESSAGE, STALE_DEPLOY_MESSAGE, UNKNOWN_MESSAGE, describeActionFailure, needsReload, runAction } from "@/lib/actions/client-action";

describe("describeActionFailure", () => {
  it("publicação nova com a tela antiga aberta pede para recarregar", () => {
    const result = describeActionFailure(new Error('Failed to find Server Action "abc123". This request might be from an older or newer deployment.'));
    assert.deepEqual(result, { ok: false, error: STALE_DEPLOY_MESSAGE, needsReload: true });
    assert.equal(needsReload(result), true);
  });

  it("sem internet no iPhone (Safari diz 'Load failed')", () => {
    assert.deepEqual(describeActionFailure(new TypeError("Load failed")), { ok: false, error: NETWORK_MESSAGE });
    assert.deepEqual(describeActionFailure(new TypeError("Failed to fetch")), { ok: false, error: NETWORK_MESSAGE });
  });

  it("qualquer outra falha vira mensagem genérica que diz que nada foi salvo", () => {
    const result = describeActionFailure("boom");
    assert.deepEqual(result, { ok: false, error: UNKNOWN_MESSAGE });
    assert.equal(needsReload(result), false);
  });
});

describe("runAction", () => {
  it("devolve o resultado do servidor quando ele responde", async () => {
    assert.deepEqual(await runAction(async () => ({ ok: true as const, message: "Feito." })), { ok: true, message: "Feito." });
  });

  it("nunca deixa a exceção escapar calada", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const result = await runAction(async () => {
        throw new TypeError("Load failed");
      });
      assert.deepEqual(result, { ok: false, error: NETWORK_MESSAGE });
    } finally {
      console.error = original;
    }
  });
});
