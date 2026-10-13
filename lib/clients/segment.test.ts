import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesSegmentFilter, segmentChoice, segmentValue } from "@/lib/clients/segment";

describe("segmento do cliente", () => {
  it("opção da lista e Outro com texto livre", () => {
    assert.deepEqual(segmentChoice("Saúde"), { option: "Saúde", custom: "" });
    assert.deepEqual(segmentChoice("varejo"), { option: "Varejo", custom: "" });
    assert.deepEqual(segmentChoice("Escola"), { option: "Outro", custom: "Escola" });
    assert.deepEqual(segmentChoice(null), { option: "", custom: "" });
    assert.equal(segmentValue("Outro", " Moda "), "Moda");
    assert.equal(segmentValue("Outro", ""), "Outro");
    assert.equal(segmentValue("Agro", "ignorado"), "Agro");
    assert.equal(segmentValue("", "x"), "");
  });

  it("filtro: opção da lista (sem acento/maiúscula) e Outro", () => {
    assert.equal(matchesSegmentFilter("Imobiliário", "imobiliario"), true);
    assert.equal(matchesSegmentFilter("Imobiliário", "Saúde"), false);
    assert.equal(matchesSegmentFilter("outro", "Escola"), true);
    assert.equal(matchesSegmentFilter("outro", "Saúde"), false);
    assert.equal(matchesSegmentFilter("outro", null), false);
  });
});
