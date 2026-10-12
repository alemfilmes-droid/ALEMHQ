import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { houseOptions, houseReturnOn, planHouseLead, type HousePlaybook, type HouseSuggestion } from "@/lib/prospeccao/house-client";

const playbooks: HousePlaybook[] = [
  { id: "matricula", audience: "escola", active: true, usesHouseClientScript: false, position: 1 },
  { id: "espetaculos", audience: "escola", active: true, usesHouseClientScript: false, position: 2 },
  { id: "recorrente-escolas", audience: "escola", active: true, usesHouseClientScript: true, position: 3 },
  { id: "institucional", audience: "empresa", active: true, usesHouseClientScript: false, position: 4 },
  { id: "recorrente-empresas", audience: "empresa", active: true, usesHouseClientScript: true, position: 5 },
];
const suggestions: HouseSuggestion[] = [
  { closedPlaybookId: "matricula", suggestedPlaybookId: "espetaculos", position: 1 },
  { closedPlaybookId: "matricula", suggestedPlaybookId: "recorrente-escolas", position: 2 },
  { closedPlaybookId: "institucional", suggestedPlaybookId: "recorrente-empresas", position: 1 },
];

describe("houseOptions (playbook padrão do cliente da casa)", () => {
  it("o que usa o script cliente da casa vem primeiro, mesmo sendo a 2ª sugestão", () => {
    assert.deepEqual(houseOptions("matricula", suggestions, playbooks, "escola"), ["recorrente-escolas", "espetaculos"]);
  });

  it("sem sugestão (ou sem negócio de origem): conteúdo recorrente do público", () => {
    assert.deepEqual(houseOptions(null, suggestions, playbooks, "empresa"), ["recorrente-empresas"]);
    assert.deepEqual(houseOptions("recorrente-escolas", suggestions, playbooks, "escola"), ["recorrente-escolas"]);
  });

  it("ignora playbook desativado", () => {
    const off = playbooks.map((playbook) => (playbook.id === "recorrente-escolas" ? { ...playbook, active: false } : playbook));
    assert.deepEqual(houseOptions("matricula", suggestions, off, "escola"), ["espetaculos"]);
  });
});

describe("houseReturnOn", () => {
  it("entrega + prazo em dias corridos, no dia de Fortaleza", () => {
    assert.equal(houseReturnOn("2026-10-13T15:00:00Z", 7), "2026-10-20");
    // 23h30 em Fortaleza do dia 31/10 (02h30 UTC de 01/11): conta a partir de 31/10.
    assert.equal(houseReturnOn("2026-11-01T02:30:00Z", 7), "2026-11-07");
    assert.equal(houseReturnOn("2026-12-28T12:00:00Z", 7), "2027-01-04");
  });
});

describe("planHouseLead", () => {
  const contact = { id: "c1", name: "Mariana Souza", role: "Coordenação", phone: "84 99988-7766" };

  it("com negócio de origem: reaproveita decisor, dono e público", () => {
    const plan = planHouseLead({
      origin: {
        dealId: "d1",
        ownerId: "paulo",
        playbookId: "matricula",
        leadType: "escola",
        contactId: "c0",
        decisionMakerName: "Rafael Lima",
        decisionMakerRole: "Diretor",
        decisionMakerWhatsapp: "84 99111-2222",
      },
      contact,
      companyIsSchool: false,
      defaultOwnerId: "sdr",
    });
    assert.deepEqual(plan, {
      originDealId: "d1",
      ownerId: "paulo",
      contactId: "c0",
      audience: "escola",
      decisionMakerName: "Rafael Lima",
      decisionMakerRole: "Diretor",
      decisionMakerWhatsapp: "84 99111-2222",
      closedPlaybookId: "matricula",
    });
  });

  it("cliente cadastrado à mão (sem negócio): o contato conhecido vira decisor e o dono é o SDR", () => {
    const plan = planHouseLead({ origin: null, contact, companyIsSchool: true, defaultOwnerId: "sdr" });
    assert.equal(plan.originDealId, null);
    assert.equal(plan.ownerId, "sdr");
    assert.equal(plan.audience, "escola");
    assert.equal(plan.decisionMakerName, "Mariana Souza");
    assert.equal(plan.decisionMakerWhatsapp, "84 99988-7766");
    assert.equal(plan.closedPlaybookId, null);
  });
});
