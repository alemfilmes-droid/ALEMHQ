import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DARK_SURFACES, TINTS, contrastRatio, hexToRgb, worstTintContrast } from "@/lib/theme/tint";

describe("pílulas em degradê: contraste WCAG AA no tema escuro", () => {
  for (const [name, tint] of Object.entries(TINTS)) {
    it(`${name}: texto ≥ 4,5:1 sobre o fundo`, () => {
      const ratio = worstTintContrast(tint, DARK_SURFACES);
      assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}:1`);
    });
  }

  it("nenhuma cor é o vermelho da marca", () => {
    for (const tint of Object.values(TINTS)) {
      for (const color of [tint.from, tint.to, tint.text]) assert.notEqual(color.toLowerCase(), "#e5231b");
    }
  });

  it("conta de contraste confere com a referência (preto × branco = 21:1)", () => {
    assert.equal(Math.round(contrastRatio(hexToRgb("#000000"), hexToRgb("#ffffff"))), 21);
  });
});
