import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/notifications/routing-cases.json";
import { CEO_CRM_TYPES, isCommercialRecipient, notificationAllowed } from "@/lib/notifications/routing";
import type { Squad } from "@/types";

const facts = (item: (typeof cases)[number]) => ({
  recipientIsCeo: item.ceo,
  recipientIsCommercial: item.commercial,
  type: item.type,
  pautaSquad: item.squad as Squad | null,
  entityIsCrm: item.crm,
  holdsBall: item.holds,
});

/** Os mesmos casos são conferidos contra public.notification_rule no banco (validação da migração). */
describe("regra única de notificações", () => {
  for (const item of cases) {
    it(`${item.name} → ${item.expected ? "chega" : "não chega"}`, () => {
      assert.equal(notificationAllowed(facts(item)), item.expected);
    });
  }
});

const CRM_TYPES = [
  "deal_qualification_review",
  "deal_request_reply",
  "deal_responsible",
  "deal_request",
  "deal_request_resolved",
  "deal_meeting_scheduled",
  "deal_assigned",
  "deal_handoff",
  "crm_action_overdue",
  "crm_stale_prospection",
  "crm_needs_update",
  "crm_reheat_ready",
];

describe("CRM: CEO só recebe os dois tipos permitidos", () => {
  it("de todos os tipos do CRM, chegam para o CEO só os dois da lista branca (com ou sem a bola)", () => {
    for (const holdsBall of [true, false, null]) {
      const allowed = CRM_TYPES.filter((type) =>
        notificationAllowed({ recipientIsCeo: true, recipientIsCommercial: true, type, pautaSquad: null, entityIsCrm: null, holdsBall }),
      );
      assert.deepEqual(allowed.sort(), [...CEO_CRM_TYPES].sort());
    }
  });
});

describe("CRM: os quatro papéis do comercial continuam recebendo tudo", () => {
  const roles = {
    SDR: { accessRole: "sdr", orgLevel: "executor", squads: ["comercial"], jobTitle: "SDR" },
    BDR: { accessRole: "bdr", orgLevel: "executor", squads: [], jobTitle: "BDR" },
    Atendimento: { accessRole: "member", orgLevel: "executor", squads: [], jobTitle: "Atendimento" },
    "Head Comercial": { accessRole: "coordinator", orgLevel: "head", squads: ["comercial"], jobTitle: "Head Comercial" },
  } as const;

  for (const [name, person] of Object.entries(roles)) {
    it(`${name}: é do comercial e recebe todos os tipos do CRM (prazos/alertas com a bola)`, () => {
      assert.equal(isCommercialRecipient(person), true);
      for (const type of CRM_TYPES) {
        assert.equal(
          notificationAllowed({ recipientIsCeo: false, recipientIsCommercial: true, type, pautaSquad: null, entityIsCrm: null, holdsBall: true }),
          true,
          type,
        );
      }
    });
  }

  it("fora do comercial (ex.: analista financeiro) não recebe CRM", () => {
    assert.equal(isCommercialRecipient({ accessRole: "member", orgLevel: "executor", squads: ["financeiro"], jobTitle: "Analista financeiro" }), false);
  });
});
