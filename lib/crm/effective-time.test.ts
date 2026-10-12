import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveDefaults, parseEffectiveTime } from "@/lib/crm/effective-time";

// 15/10/2026 14h30 em Fortaleza (17h30 UTC).
const NOW = new Date("2026-10-15T17:30:00Z");

describe("horário efetivo do contato", () => {
  it("padrão é agora, em Fortaleza; limite de 7 dias para trás", () => {
    assert.deepEqual(effectiveDefaults(NOW), { date: "2026-10-15", time: "14:30", minDate: "2026-10-08", maxDate: "2026-10-15" });
  });

  it("aceita um horário de ontem e devolve o instante certo (UTC-3)", () => {
    assert.deepEqual(parseEffectiveTime("2026-10-14", "16:00", NOW), { ok: true, iso: "2026-10-14T19:00:00.000Z" });
  });

  it("recusa futuro", () => {
    const result = parseEffectiveTime("2026-10-15", "18:00", NOW);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /futuro/);
  });

  it("aceita 2 minutos à frente (relógio do celular adiantado)", () => {
    assert.equal(parseEffectiveTime("2026-10-15", "14:31", NOW).ok, true);
  });

  it("recusa mais de 7 dias atrás", () => {
    const result = parseEffectiveTime("2026-10-08", "14:00", NOW);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /7 dias/);
    assert.equal(parseEffectiveTime("2026-10-08", "15:00", NOW).ok, true);
  });

  it("formato inválido", () => {
    assert.equal(parseEffectiveTime("15/10/2026", "14:00", NOW).ok, false);
  });
});
