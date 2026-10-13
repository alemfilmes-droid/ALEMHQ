import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/agenda/crm-items-cases.json";
import { crmPautaOnAgenda } from "@/lib/agenda/crm-items";

/** Os mesmos casos são conferidos contra public.crm_pauta_on_agenda_rule no banco (validação da migração). */
describe("prazos do CRM na agenda e no Google", () => {
  for (const item of cases) {
    it(item.name, () => {
      const ceo = "ceo" in item ? (item.ceo ?? null) : "ceo";
      assert.equal(crmPautaOnAgenda(item.assignee, item.people, ceo), item.expected);
    });
  }
});
