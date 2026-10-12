import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { celebrationText, CONFETTI_COLORS, confettiPieces, shouldAnimateConfetti } from "@/lib/goals/celebration";

describe("comemoração de comissão", () => {
  it("primeiro nome em destaque e o valor embaixo, com a meta", () => {
    const text = celebrationText("Paulo Souza", 150_000, "Campanha de matrícula");
    assert.equal(text.title, "Parabéns, Paulo!");
    assert.match(text.amount, /^Você ganhou R\$\s?1\.500,00 de comissão$/);
    assert.equal(text.goal, "Meta: Campanha de matrícula");
  });

  it("comissão avulsa (sem meta)", () => {
    assert.equal(celebrationText("Anna Clara", 25_000, null).goal, null);
  });

  it("sem animação para quem pediu menos movimento", () => {
    assert.equal(shouldAnimateConfetti(true), false);
    assert.equal(shouldAnimateConfetti(false), true);
  });

  it("confete usa só as cores permitidas (nunca o vermelho da marca)", () => {
    const pieces = confettiPieces(50, 400, () => 0.42);
    assert.equal(pieces.length, 50);
    assert.ok(pieces.every((piece) => (CONFETTI_COLORS as readonly string[]).includes(piece.color)));
    assert.ok(!(CONFETTI_COLORS as readonly string[]).includes("#E5231B"));
  });
});
