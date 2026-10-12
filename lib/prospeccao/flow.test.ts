import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCadenceState, isDueNow, type CadenceLead, type CadenceRules, type SentTouch } from "@/lib/prospeccao/cadence";
import { buildMessage, checkFinalText, whatsappUrl } from "@/lib/prospeccao/message";
import { LEAD, PLAYBOOK, SCRIPTS } from "@/lib/prospeccao/message-fixtures";
import { holidayCalendar } from "@/lib/prospeccao/time";

/**
 * Fluxo completo num lead de demonstração, sem banco: o mesmo motor e a mesma montagem de mensagem
 * que o card usa. Cada "Marcar enviado" vira um toque com o texto editado.
 */

const calendar = holidayCalendar([{ date: "2000-10-12", recurring: true }]);
const rules: CadenceRules = { offsets: [0, 2, 5, 10], reactivationDays: 30, reactivationScriptEmpty: false, usesHouseClientScript: false };
const at = (day: string, time = "10:00") => new Date(`${day}T${time}:00-03:00`).toISOString();

describe("fluxo: prévia → edição → enviado → próximo toque → respondeu", () => {
  it("percorre a cadência como o Paulo faria", () => {
    const lead: CadenceLead = {
      funnel: "aberto",
      contactIsDecisionMaker: false,
      decisionMakerSetAt: at("2026-10-13", "09:00"),
      hook: LEAD.hook,
      lastDeliveredProject: null,
      cadenceStartedAt: at("2026-10-13", "09:00"),
      repliedAt: null,
      pausedAt: null,
      resumedAt: null,
      discardedAt: null,
      manualReactivationOn: null,
      restartedAt: null,
      houseReturnOn: null,
    };
    const touches: SentTouch[] = [];
    const today = "2026-10-13";

    // 1. Abre a prévia do Toque 1.
    const first = getCadenceState(lead, touches, rules, calendar, today);
    assert.ok(first && isDueNow(first));
    const preview = buildMessage({ state: first, scripts: SCRIPTS, playbook: PLAYBOOK, lead: LEAD, now: new Date(at(today)) });
    assert.ok(preview.ok);

    // 2. Edita o texto e abre o WhatsApp com a versão final.
    const edited = `${preview.text}\nAbraço!`;
    assert.equal(checkFinalText(edited), null);
    assert.ok(whatsappUrl(preview.recipient, edited).endsWith("%0AAbra%C3%A7o!"));

    // 3. Marca enviado: o texto gravado é o editado; o Toque 2 vence 2 dias úteis depois.
    touches.push({ touchNumber: preview.touchNumber, sentAt: at(today, "10:05") });
    const second = getCadenceState(lead, touches, rules, calendar, today);
    assert.equal(second?.currentTouch, 2);
    assert.equal(second?.nextDueDate, "2026-10-15");
    assert.equal(second?.status, "em_cadencia");
    assert.equal(isDueNow(second ?? null), false);

    // 4. No dia, o Toque 2 entra na fila com o link personalizado.
    const due = getCadenceState(lead, touches, rules, calendar, "2026-10-15");
    assert.equal(due?.status, "chamar_hoje");
    const touchTwo = due && buildMessage({ state: due, scripts: SCRIPTS, playbook: PLAYBOOK, lead: LEAD, now: new Date(at("2026-10-15")) });
    assert.ok(touchTwo?.ok && touchTwo.text.includes("?escola=Col%C3%A9gio%20S%C3%A3o%20Jos%C3%A9"));

    // 5. O lead responde: a cadência para e sai da fila.
    const replied = getCadenceState({ ...lead, repliedAt: at("2026-10-14", "15:00") }, touches, rules, calendar, "2026-10-15");
    assert.equal(replied?.status, "em_conversa");
    assert.equal(isDueNow(replied ?? null), false);
    assert.equal(replied?.applicableScript, null);
  });
});
