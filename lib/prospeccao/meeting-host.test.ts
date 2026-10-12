import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { busySourcesFor, hostChoiceLabel, hostChoiceOf, meetingAttendee } from "@/lib/prospeccao/meeting-host";

const people = { ceoId: "anderson", ownerId: "paulo" };

describe("reunião com Anderson × reunião com Paulo (kick-off)", () => {
  it("com o Anderson: ele atende (e fica com a bola); horários do Google dele + HQ", () => {
    assert.equal(meetingAttendee("anderson", people), "anderson");
    assert.deepEqual(busySourcesFor(true), ["google", "hq"]);
  });

  it("com o Paulo: ele atende; nada chega ao Anderson", () => {
    assert.equal(meetingAttendee("sdr", people), "paulo");
    assert.notEqual(meetingAttendee("sdr", people), people.ceoId);
  });

  it("Google do Paulo só entra se estiver conectado; senão, só a agenda do HQ", () => {
    assert.deepEqual(busySourcesFor(false), ["hq"]);
  });

  it("reagendar mantém quem atende", () => {
    assert.equal(hostChoiceOf("anderson", "anderson"), "anderson");
    assert.equal(hostChoiceOf("paulo", "anderson"), "sdr");
  });

  it("rótulos com o primeiro nome", () => {
    assert.equal(hostChoiceLabel("anderson", { ceo: "Anderson Felipe", sdr: "Paulo Souza" }), "Reunião com Anderson");
    assert.equal(hostChoiceLabel("sdr", { ceo: "Anderson Felipe", sdr: "Paulo Souza" }), "Reunião com Paulo (kick-off)");
  });
});
