import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitWithin } from "@/lib/images/downscale";

describe("fitWithin", () => {
  it("foto de 12 MP do iPhone cai para 512 px no lado maior", () => {
    assert.deepEqual(fitWithin(4032, 3024, 512), { width: 512, height: 384 });
  });
  it("retrato mantém a proporção", () => {
    assert.deepEqual(fitWithin(3024, 4032, 512), { width: 384, height: 512 });
  });
  it("imagem pequena não é aumentada", () => {
    assert.deepEqual(fitWithin(200, 120, 512), { width: 200, height: 120 });
  });
});
