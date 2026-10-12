import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeWhatsapp } from "@/lib/prospeccao/phone";

const ok = (raw: string) => {
  const result = normalizeWhatsapp(raw);
  assert.ok(result.ok, `esperava válido: ${raw}`);
  return result;
};
const error = (raw: string) => {
  const result = normalizeWhatsapp(raw);
  assert.equal(result.ok, false, `esperava inválido: ${raw}`);
  return result.ok ? "" : result.error;
};

describe("normalizeWhatsapp", () => {
  it("aceita com e sem 55, com pontuação", () => {
    for (const raw of ["5584999887766", "+55 (84) 99988-7766", "84 99988 7766", "(84)99988-7766", "084 99988-7766"]) {
      assert.equal(ok(raw).number, "5584999887766", raw);
    }
  });

  it("sem DDD assume 84 e avisa", () => {
    const result = ok("99988-7766");
    assert.equal(result.number, "5584999887766");
    assert.equal(result.assumedDdd, true);
    assert.equal(ok("84 99988-7766").assumedDdd, false);
  });

  it("formata para exibir", () => {
    assert.equal(ok("11 98765-4321").display, "+55 (11) 98765-4321");
  });

  it("recusa fixo, celular sem o 9, DDD inexistente e tamanho errado", () => {
    assert.match(error("84 3201-1234"), /fixo/);
    assert.match(error("84 8888-1234"), /9 dígitos/);
    assert.match(error("20 99988-7766"), /DDD 20/);
    assert.match(error("12345"), /dígitos/);
    assert.match(error(""), /Falta/);
    assert.match(error("84 89988-7766"), /começar com 9/);
  });
});
