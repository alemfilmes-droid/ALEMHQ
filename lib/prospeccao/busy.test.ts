import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALENDAR_UNAVAILABLE, collectBusy, type BusySource } from "@/lib/prospeccao/busy";

const block = { start: "2026-10-14T12:00:00.000Z", end: "2026-10-14T12:45:00.000Z" };
const from = new Date("2026-10-13T00:00:00Z");
const to = new Date("2026-10-30T00:00:00Z");

describe("collectBusy (Google simulado)", () => {
  it("junta os horários de todas as fontes", async () => {
    const google: BusySource = { label: "Google", load: async () => [block] };
    const hq: BusySource = { label: "HQ", load: async () => [{ ...block, start: "2026-10-15T12:00:00.000Z", end: "2026-10-15T13:00:00.000Z" }] };
    const result = await collectBusy([google, hq], from, to);
    assert.ok(result.ok);
    assert.equal(result.busy.length, 2);
  });

  it("se o Google falhar, avisa em português e não sugere horário sem ele", async () => {
    const google: BusySource = { label: "Google", load: async () => Promise.reject(new Error("503")) };
    const hq: BusySource = { label: "HQ", load: async () => [block] };
    assert.deepEqual(await collectBusy([google, hq], from, to), { ok: false, error: CALENDAR_UNAVAILABLE });
  });

  it("aceita uma fonte nova (ex.: WAWS) sem mudar nada", async () => {
    const waws: BusySource = { label: "WAWS", load: async (start) => [{ start: start.toISOString(), end: to.toISOString() }] };
    const result = await collectBusy([waws], from, to);
    assert.ok(result.ok && result.busy[0]?.start === from.toISOString());
  });
});
