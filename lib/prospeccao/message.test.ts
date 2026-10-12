import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CadenceState } from "@/lib/prospeccao/cadence";
import { buildMessage, checkFinalText, pickScript, whatsappUrl } from "@/lib/prospeccao/message";
import { LEAD, PLAYBOOK, SCRIPTS } from "@/lib/prospeccao/message-fixtures";

// 13/10/2026 10h em Fortaleza.
const now = new Date("2026-10-13T13:00:00Z");

function state(overrides: Partial<CadenceState>): CadenceState {
  return {
    status: "chamar_hoje",
    currentTouch: 1,
    totalTouches: 4,
    isReactivation: false,
    nextDueDate: "2026-10-13",
    applicableScript: { kind: "toque", scriptTouchNumber: 1 },
    ...overrides,
  };
}

const build = (s: CadenceState, lead = LEAD, scripts = SCRIPTS) => buildMessage({ state: s, scripts, playbook: PLAYBOOK, lead, now });

describe("pickScript", () => {
  it("escolhe o script certo para cada tipo", () => {
    const pick = (s: CadenceState, audience: "escola" | "empresa" = "escola") => pickScript(SCRIPTS, s, PLAYBOOK, audience)?.id;
    assert.equal(pick(state({ currentTouch: 0, applicableScript: { kind: "toque_zero", scriptTouchNumber: null } })), "t0-mat");
    assert.equal(pick(state({ applicableScript: { kind: "sem_gancho", scriptTouchNumber: null } })), "sg-esc");
    assert.equal(pick(state({ applicableScript: { kind: "sem_gancho", scriptTouchNumber: null } }), "empresa"), "sg-emp");
    assert.equal(pick(state({ applicableScript: { kind: "cliente_da_casa", scriptTouchNumber: null } })), "casa-esc");
    assert.equal(pick(state({ currentTouch: 2, applicableScript: { kind: "toque", scriptTouchNumber: 2 } })), "t2");
    assert.equal(pick(state({ currentTouch: null, isReactivation: true, applicableScript: { kind: "reativacao", scriptTouchNumber: null } })), "reat");
    // Reativação vazia: o motor manda o Toque 1.
    assert.equal(pick(state({ currentTouch: null, isReactivation: true, applicableScript: { kind: "toque", scriptTouchNumber: 1 } })), "t1");
  });
});

describe("buildMessage", () => {
  it("Toque 1: decisor, primeiro nome, gancho e WhatsApp do decisor", () => {
    const result = build(state({}));
    assert.ok(result.ok);
    assert.equal(result.text, "Mariana, vi o perfil do Colégio São José e vi a unidade nova.");
    assert.equal(result.recipient, "5584999887766");
    assert.equal(result.touchNumber, 1);
    assert.equal(result.scriptId, "t1");
  });

  it("Toque 0 vai para o contato geral e não precisa do nome do decisor", () => {
    const lead = { ...LEAD, decisionMakerName: null, decisionMakerWhatsapp: null, contactPhone: "84 98877-6655" };
    const result = build(state({ currentTouch: 0, applicableScript: { kind: "toque_zero", scriptTouchNumber: null } }), lead);
    assert.ok(result.ok);
    assert.equal(result.text, "Bom dia. Preciso falar com quem decide.");
    assert.equal(result.recipient, "5584988776655");
    assert.equal(result.touchNumber, 0);
  });

  it("contato que decide: usa o nome e o WhatsApp do contato", () => {
    const lead = { ...LEAD, contactIsDecisionMaker: true, contactName: "Rafael Lima", contactPhone: "84 99111-2222", decisionMakerName: null, decisionMakerWhatsapp: null };
    const result = build(state({}), lead);
    assert.ok(result.ok);
    assert.ok(result.text.startsWith("Rafael,"));
    assert.equal(result.recipient, "5584991112222");
  });

  it("{link} com ?escola= codificado (acentos e espaços) e quebra de linha preservada", () => {
    const result = build(state({ currentTouch: 2, applicableScript: { kind: "toque", scriptTouchNumber: 2 } }));
    assert.ok(result.ok);
    assert.equal(result.text, "Mariana, preparei uma página:\nhttps://www.alemfilmes.com.br/institucional?escola=Col%C3%A9gio%20S%C3%A3o%20Jos%C3%A9");
    const url = whatsappUrl(result.recipient, result.text);
    assert.ok(url.startsWith("https://wa.me/5584999887766?text="));
    assert.ok(url.includes("p%C3%A1gina%3A%0Ahttps"), "quebra de linha vira %0A e acento é preservado");
    assert.equal(decodeURIComponent(url.split("?text=")[1] ?? ""), result.text);
  });

  it("bloqueia sem nome do decisor no Toque 1+", () => {
    const result = build(state({}), { ...LEAD, decisionMakerName: null });
    assert.deepEqual(result, { ok: false, error: "Falta o nome do decisor." });
  });

  it("bloqueia sem link (URL pendente) e sem WhatsApp do decisor", () => {
    const pending = buildMessage({
      state: state({ currentTouch: 2, applicableScript: { kind: "toque", scriptTouchNumber: 2 } }),
      scripts: SCRIPTS,
      playbook: { ...PLAYBOOK, linkBase: "" },
      lead: LEAD,
      now,
    });
    assert.equal(pending.ok, false);
    assert.match(pending.ok ? "" : pending.error, /URL pendente/);
    const noPhone = build(state({}), { ...LEAD, decisionMakerWhatsapp: null });
    assert.deepEqual(noPhone, { ok: false, error: "Falta o WhatsApp do decisor." });
  });

  it("bloqueia telefone inválido e avisa DDD assumido", () => {
    const fixed = build(state({}), { ...LEAD, decisionMakerWhatsapp: "84 3201-1234" });
    assert.equal(fixed.ok, false);
    const noDdd = build(state({}), { ...LEAD, decisionMakerWhatsapp: "99988-7766" });
    assert.ok(noDdd.ok);
    assert.equal(noDdd.assumedDdd, true);
  });

  it("bloqueia script vazio ou com variável desconhecida", () => {
    const empty = SCRIPTS.map((script) => (script.id === "t1" ? { ...script, body: " " } : script));
    const blank = build(state({}), LEAD, empty);
    assert.match(blank.ok ? "" : blank.error, /ainda não foi escrito/);
    const typo = SCRIPTS.map((script) => (script.id === "t1" ? { ...script, body: "{nom}, oi" } : script));
    const result = build(state({}), LEAD, typo);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /\{nom\}/);
  });

  it("sem envio pendente não monta mensagem", () => {
    assert.equal(build(state({ status: "em_conversa", applicableScript: null })).ok, false);
  });

  it("reativação usa {mês} do envio e vai sem número de toque", () => {
    const result = build(state({ currentTouch: null, isReactivation: true, applicableScript: { kind: "reativacao", scriptTouchNumber: null } }));
    assert.ok(result.ok);
    assert.equal(result.text, "Mariana, retomando: agenda de novembro.");
    assert.equal(result.touchNumber, null);
  });
});

describe("checkFinalText", () => {
  it("bloqueia vazio e {variável} esquecida na edição", () => {
    assert.equal(checkFinalText("Olá, Mariana."), null);
    assert.match(checkFinalText("  ") ?? "", /vazia/);
    assert.match(checkFinalText("Olá, {nome}.") ?? "", /\{nome\}/);
  });
});
