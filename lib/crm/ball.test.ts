import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/crm/ball-cases.json";
import { ballForStage } from "@/lib/crm/ball";
import type { DealStage } from "@/types";

const IDS: Record<string, string> = { sdr: "paulo", ceo: "anderson", x: "quem-estava" };

/** Os mesmos casos são conferidos contra public.crm_ball_for_stage no banco (validação da migração). */
describe("com a bola agora", () => {
  for (const item of cases) {
    it(item.name, () => {
      const holder = ballForStage(item.stage as DealStage, {
        owner: IDS.sdr!,
        ceo: IDS.ceo!,
        attendee: item.attendee ? IDS[item.attendee]! : null,
        current: IDS[item.current]!,
        fastTrack: item.fastTrack ?? false,
      });
      assert.equal(holder, item.expected ? IDS[item.expected] : null);
    });
  }
});
