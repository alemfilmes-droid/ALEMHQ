import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/notifications/routing-cases.json";
import { notificationAllowed } from "@/lib/notifications/routing";
import type { Squad } from "@/types";

/** Os mesmos casos são conferidos contra public.notification_rule no banco (validação da migração). */
describe("regra única de notificações", () => {
  for (const item of cases) {
    it(`${item.name} → ${item.expected ? "chega" : "não chega"}`, () => {
      const allowed = notificationAllowed({
        recipientIsCeo: item.ceo,
        type: item.type,
        pautaSquad: item.squad as Squad | null,
        pautaIsCrm: item.crm,
        holdsBall: item.holds,
      });
      assert.equal(allowed, item.expected);
    });
  }
});
