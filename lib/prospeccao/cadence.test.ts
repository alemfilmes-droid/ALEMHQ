import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareQueue, getCadenceState, isDueNow, type CadenceLead, type CadenceRules, type CadenceState, type SentTouch } from "@/lib/prospeccao/cadence";
import { holidayCalendar } from "@/lib/prospeccao/time";

const calendar = holidayCalendar([
  { date: "2000-01-01", recurring: true },
  { date: "2000-10-12", recurring: true },
  { date: "2000-11-02", recurring: true },
  { date: "2000-11-20", recurring: true },
  { date: "2000-12-25", recurring: true },
]);

const SAZONAL: CadenceRules = { offsets: [0, 2, 5, 10], reactivationDays: 30, reactivationScriptEmpty: false, usesHouseClientScript: false };
const RELACIONAMENTO: CadenceRules = { offsets: [0, 3, 8, 15, 25], reactivationDays: 60, reactivationScriptEmpty: true, usesHouseClientScript: false };

/** 10h em Fortaleza do dia informado. */
const at = (day: string, time = "10:00") => new Date(`${day}T${time}:00-03:00`).toISOString();

function lead(overrides: Partial<CadenceLead> = {}): CadenceLead {
  return {
    funnel: "aberto",
    contactIsDecisionMaker: true,
    decisionMakerSetAt: null,
    hook: "vi a unidade nova",
    lastDeliveredProject: null,
    cadenceStartedAt: at("2026-10-13"),
    repliedAt: null,
    pausedAt: null,
    resumedAt: null,
    discardedAt: null,
    manualReactivationOn: null,
    restartedAt: null,
    houseReturnOn: null,
    ...overrides,
  };
}

const sent = (touchNumber: number | null, day: string): SentTouch => ({ touchNumber, sentAt: at(day) });

function state(l: CadenceLead, touches: SentTouch[], today: string, rules = SAZONAL): CadenceState {
  const result = getCadenceState(l, touches, rules, calendar, today);
  assert.ok(result, "esperava um estado de cadência");
  return result;
}

describe("Toque 1", () => {
  it("vence no dia do cadastro e fica Atrasado depois", () => {
    const l = lead();
    assert.deepEqual(state(l, [], "2026-10-13"), {
      status: "chamar_hoje",
      currentTouch: 1,
      totalTouches: 4,
      isReactivation: false,
      nextDueDate: "2026-10-13",
      applicableScript: { kind: "toque", scriptTouchNumber: 1 },
    });
    assert.equal(state(l, [], "2026-10-14").status, "atrasado");
    assert.equal(state(l, [], "2026-10-12").status, "em_cadencia");
  });

  it("cadastro no sábado vence na segunda; feriado na segunda empurra para terça", () => {
    assert.equal(state(lead({ cadenceStartedAt: at("2026-10-17") }), [], "2026-10-17").nextDueDate, "2026-10-19");
    // 10/10/2026 sábado → 12/10 segunda é feriado (N. Sra. Aparecida) → 13/10.
    assert.equal(state(lead({ cadenceStartedAt: at("2026-10-10") }), [], "2026-10-10").nextDueDate, "2026-10-13");
  });

  it("cadastro às 23h em Fortaleza (02h UTC do dia seguinte) conta o dia de Fortaleza", () => {
    const l = lead({ cadenceStartedAt: new Date("2026-10-15T02:00:00Z").toISOString() });
    assert.equal(state(l, [], "2026-10-14").nextDueDate, "2026-10-14");
  });

  it("sem gancho usa a versão sem gancho; cliente da casa usa o script dele", () => {
    assert.deepEqual(state(lead({ hook: "  " }), [], "2026-10-13").applicableScript, { kind: "sem_gancho", scriptTouchNumber: null });
    const houseRules = { ...RELACIONAMENTO, usesHouseClientScript: true };
    assert.deepEqual(state(lead({ lastDeliveredProject: "Fest Show" }), [], "2026-10-13", houseRules).applicableScript, {
      kind: "cliente_da_casa",
      scriptTouchNumber: null,
    });
  });
});

describe("dias úteis entre toques", () => {
  it("sazonal no prazo: dias 0, 2, 5, 10 a partir do Toque 1", () => {
    const l = lead();
    assert.equal(state(l, [sent(1, "2026-10-13")], "2026-10-13").nextDueDate, "2026-10-15");
    assert.equal(state(l, [sent(1, "2026-10-13"), sent(2, "2026-10-15")], "2026-10-15").nextDueDate, "2026-10-20");
    const third = state(l, [sent(1, "2026-10-13"), sent(2, "2026-10-15"), sent(3, "2026-10-20")], "2026-10-20");
    assert.equal(third.nextDueDate, "2026-10-27");
    assert.equal(third.currentTouch, 4);
  });

  it("pula fim de semana e feriado (Finados)", () => {
    // Toque 1 na quinta 29/10 → +2 úteis: sex 30, (sáb, dom, seg 02/11 feriado) ter 03/11.
    assert.equal(state(lead(), [sent(1, "2026-10-29")], "2026-10-29").nextDueDate, "2026-11-03");
  });

  it("atravessa mês e ano (Natal e Ano-Novo)", () => {
    // Relacionamento: Toque 1 em 23/12 → +3 úteis: 24, 28, 29.
    assert.equal(state(lead(), [sent(1, "2026-12-23")], "2026-12-23", RELACIONAMENTO).nextDueDate, "2026-12-29");
    // Toque 2 em 29/12 → +5 úteis (8 − 3): 30, 31, 04/01, 05/01, 06/01.
    assert.equal(state(lead(), [sent(1, "2026-12-23"), sent(2, "2026-12-29")], "2026-12-29", RELACIONAMENTO).nextDueDate, "2027-01-06");
  });

  it("regra 7: toque enviado atrasado empurra os próximos a partir do envio real", () => {
    // Toque 2 previsto para 15/10, enviado em 19/10 → Toque 3 = 19/10 + 3 úteis = 22/10 (não 20/10).
    const late = state(lead(), [sent(1, "2026-10-13"), sent(2, "2026-10-19")], "2026-10-19");
    assert.equal(late.nextDueDate, "2026-10-22");
    assert.equal(late.currentTouch, 3);
  });

  it("toque atrasado fica Atrasado até ser enviado", () => {
    const overdue = state(lead(), [sent(1, "2026-10-13")], "2026-10-21");
    assert.equal(overdue.status, "atrasado");
    assert.equal(overdue.nextDueDate, "2026-10-15");
    assert.equal(overdue.currentTouch, 2);
  });
});

describe("Toque 0 e decisor", () => {
  const secretary = lead({ contactIsDecisionMaker: false });

  it("começa no Toque 0 no dia do cadastro", () => {
    const s = state(secretary, [], "2026-10-13");
    assert.equal(s.status, "chamar_hoje");
    assert.equal(s.currentTouch, 0);
    assert.deepEqual(s.applicableScript, { kind: "toque_zero", scriptTouchNumber: null });
  });

  it("depois do Toque 0, aguarda o decisor (fora da fila)", () => {
    const s = state(secretary, [sent(0, "2026-10-13")], "2026-10-20");
    assert.equal(s.status, "aguardando_decisor");
    assert.equal(isDueNow(s), false);
  });

  it("decisor salvo: Toque 1 vence no mesmo dia útil, e a cadência conta dali", () => {
    const withDecisor = { ...secretary, decisionMakerSetAt: at("2026-10-16", "15:00") };
    const touchOne = state(withDecisor, [sent(0, "2026-10-13")], "2026-10-16");
    assert.equal(touchOne.status, "chamar_hoje");
    assert.equal(touchOne.currentTouch, 1);
    assert.equal(touchOne.nextDueDate, "2026-10-16");
    assert.equal(state(withDecisor, [sent(0, "2026-10-13"), sent(1, "2026-10-16")], "2026-10-16").nextDueDate, "2026-10-20");
  });

  it("decisor já informado no cadastro dispensa o Toque 0", () => {
    const s = state(lead({ contactIsDecisionMaker: false, decisionMakerSetAt: at("2026-10-13") }), [], "2026-10-13");
    assert.equal(s.currentTouch, 1);
  });
});

describe("cliente da casa", () => {
  const houseRules = { ...RELACIONAMENTO, usesHouseClientScript: true };
  const house = lead({ lastDeliveredProject: "Fest Show 2026", houseReturnOn: "2026-10-20", hook: null, contactIsDecisionMaker: true });

  it("fica fora da fila até o dia da volta e entra nele", () => {
    const before = state(house, [], "2026-10-19", houseRules);
    assert.equal(before.status, "em_cadencia");
    assert.equal(before.nextDueDate, "2026-10-20");
    assert.equal(state(house, [], "2026-10-20", houseRules).status, "chamar_hoje");
  });

  it("primeiro toque com o script cliente da casa; playbook sem ele usa o Toque 1 (sem gancho → versão sem gancho)", () => {
    assert.deepEqual(state(house, [], "2026-10-20", houseRules).applicableScript, { kind: "cliente_da_casa", scriptTouchNumber: null });
    assert.deepEqual(state(house, [], "2026-10-20", SAZONAL).applicableScript, { kind: "sem_gancho", scriptTouchNumber: null });
    assert.deepEqual(state({ ...house, hook: "abriram turma nova" }, [], "2026-10-20", SAZONAL).applicableScript, { kind: "toque", scriptTouchNumber: 1 });
  });

  it("depois do primeiro toque, segue do Toque 2 com as regras normais", () => {
    const next = state(house, [sent(1, "2026-10-20")], "2026-10-20", houseRules);
    assert.equal(next.currentTouch, 2);
    assert.equal(next.nextDueDate, "2026-10-23");
    assert.deepEqual(next.applicableScript, { kind: "toque", scriptTouchNumber: 2 });
  });

  it("não passa pelo Toque 0 mesmo sem decisor marcado", () => {
    assert.equal(state({ ...house, contactIsDecisionMaker: false }, [], "2026-10-20", houseRules).currentTouch, 1);
  });
});

describe("novo decisor com cadência reiniciada", () => {
  it("volta ao Toque 1 no dia do reinício e ignora toques e resposta anteriores", () => {
    const l = lead({ repliedAt: at("2026-10-14"), restartedAt: at("2026-10-20", "09:00") });
    const touches = [sent(1, "2026-10-13"), sent(2, "2026-10-15")];
    const s = state(l, touches, "2026-10-20");
    assert.equal(s.status, "chamar_hoje");
    assert.equal(s.currentTouch, 1);
    assert.equal(s.nextDueDate, "2026-10-20");
    assert.equal(state(l, [...touches, sent(1, "2026-10-20")], "2026-10-20").nextDueDate, "2026-10-22");
  });
});

describe("resposta, pausa e descarte", () => {
  it("Respondeu para a cadência na hora", () => {
    const s = state(lead({ repliedAt: at("2026-10-14", "11:00") }), [sent(1, "2026-10-13")], "2026-10-20");
    assert.equal(s.status, "em_conversa");
    assert.equal(s.applicableScript, null);
    assert.equal(isDueNow(s), false);
  });

  it("pausado sai da fila; ao retomar, o toque vence no dia da retomada", () => {
    const touches = [sent(1, "2026-10-13")];
    assert.equal(state(lead({ pausedAt: at("2026-10-14") }), touches, "2026-10-30").status, "pausado");
    const resumed = state(lead({ resumedAt: at("2026-10-30") }), touches, "2026-10-30");
    assert.equal(resumed.status, "chamar_hoje");
    assert.equal(resumed.nextDueDate, "2026-10-30");
  });

  it("retomar antes do vencimento não antecipa o toque", () => {
    assert.equal(state(lead({ resumedAt: at("2026-10-13", "12:00") }), [sent(1, "2026-10-13")], "2026-10-13").nextDueDate, "2026-10-15");
  });

  it("descartado vence a pausa e tudo o mais", () => {
    assert.equal(state(lead({ discardedAt: at("2026-10-14"), pausedAt: at("2026-10-14") }), [], "2026-10-20").status, "descartado");
  });

  it("reunião marcada sai da cadência; ganho ou perdido fica fora", () => {
    assert.equal(state(lead({ funnel: "reuniao" }), [sent(1, "2026-10-13")], "2026-10-20").status, "reuniao_marcada");
    assert.equal(getCadenceState(lead({ funnel: "fechado" }), [], SAZONAL, calendar, "2026-10-20"), null);
  });
});

describe("fim da cadência e reativação", () => {
  const allSazonal = [sent(1, "2026-10-13"), sent(2, "2026-10-15"), sent(3, "2026-10-20"), sent(4, "2026-10-27")];

  it("sazonal: Sem resposta até 30 dias corridos, depois Reativar com o script de reativação", () => {
    const waiting = state(lead(), allSazonal, "2026-11-20");
    assert.equal(waiting.status, "sem_resposta");
    assert.equal(waiting.nextDueDate, "2026-11-26");
    assert.equal(isDueNow(waiting), false);
    const due = state(lead(), allSazonal, "2026-11-26");
    assert.equal(due.status, "reativar");
    assert.equal(due.isReactivation, true);
    assert.deepEqual(due.applicableScript, { kind: "reativacao", scriptTouchNumber: null });
  });

  it("relacionamento: 60 dias; reativação vazia usa o Toque 1", () => {
    const all = [sent(1, "2026-10-13"), sent(2, "2026-10-16"), sent(3, "2026-10-23"), sent(4, "2026-11-04"), sent(5, "2026-11-18")];
    // 18/11 + 60 = 17/01/2027 (domingo) → 18/01.
    const due = state(lead(), all, "2027-01-18", RELACIONAMENTO);
    assert.equal(due.status, "reativar");
    assert.equal(due.nextDueDate, "2027-01-18");
    assert.deepEqual(due.applicableScript, { kind: "toque", scriptTouchNumber: 1 });
    assert.equal(state(lead(), all, "2027-01-15", RELACIONAMENTO).status, "sem_resposta");
  });

  it("reativação sem resposta repete o ciclo", () => {
    const afterReactivation = [...allSazonal, sent(null, "2026-11-26")];
    assert.equal(state(lead(), afterReactivation, "2026-12-01").status, "sem_resposta");
    // 26/11 + 30 = 26/12 (sábado) → 28/12.
    assert.equal(state(lead(), afterReactivation, "2026-12-28").status, "reativar");
  });

  it("resposta antiga não segura o lead em conversa depois de um novo toque", () => {
    const l = lead({ repliedAt: at("2026-10-14") });
    assert.equal(state(l, [...allSazonal, sent(null, "2026-11-26")], "2026-12-01").status, "sem_resposta");
  });
});

describe("reativação manual (objeção com data)", () => {
  it("substitui a cadência até a data, mesmo depois de resposta", () => {
    const l = lead({ repliedAt: at("2026-10-14"), manualReactivationOn: "2027-02-01" });
    const waiting = state(l, [sent(1, "2026-10-13")], "2026-12-01");
    assert.equal(waiting.status, "em_cadencia");
    assert.equal(waiting.nextDueDate, "2027-02-01");
    assert.equal(waiting.isReactivation, true);
    assert.equal(state(l, [sent(1, "2026-10-13")], "2027-02-01").status, "reativar");
  });

  it("data em feriado cai no próximo dia útil", () => {
    const l = lead({ manualReactivationOn: "2026-12-25" });
    assert.equal(state(l, [sent(1, "2026-10-13")], "2026-12-28").nextDueDate, "2026-12-28");
  });

  it("depois do envio na data, volta para o ciclo normal", () => {
    const l = lead({ manualReactivationOn: "2026-11-03" });
    const touches = [sent(1, "2026-10-13"), sent(null, "2026-11-03")];
    const s = state(l, touches, "2026-11-10");
    assert.equal(s.status, "sem_resposta");
    assert.equal(s.nextDueDate, "2026-12-03");
  });
});

describe("orçamento recusado (Perdido com data)", () => {
  it("sem data fica fora; com data volta como Reativar no dia", () => {
    const touches = [sent(1, "2026-10-13")];
    assert.equal(getCadenceState(lead({ funnel: "perdido" }), touches, SAZONAL, calendar, "2026-11-24"), null);
    const l = lead({ funnel: "perdido", manualReactivationOn: "2026-11-24", repliedAt: at("2026-10-14") });
    assert.equal(state(l, touches, "2026-11-23").status, "em_cadencia");
    assert.equal(state(l, touches, "2026-11-24").status, "reativar");
  });
});

describe("fila Chamar hoje", () => {
  it("atrasados primeiro, depois por data; quem não vence agora fica fora", () => {
    const today = "2026-10-20";
    const states = [
      state(lead({ cadenceStartedAt: at("2026-10-20") }), [], today),
      state(lead({ cadenceStartedAt: at("2026-10-14") }), [], today),
      state(lead({ cadenceStartedAt: at("2026-10-13") }), [], today),
      state(lead({ cadenceStartedAt: at("2026-10-20") }), [sent(1, "2026-10-20")], today),
    ].filter(isDueNow);
    assert.deepEqual(
      states.sort(compareQueue).map((item) => [item.status, item.nextDueDate]),
      [
        ["atrasado", "2026-10-13"],
        ["atrasado", "2026-10-14"],
        ["chamar_hoje", "2026-10-20"],
      ],
    );
  });
});
