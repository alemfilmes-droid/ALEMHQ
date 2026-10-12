import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { greetingFor, placeholdersIn, playbookLink, renderScript, unknownPlaceholders } from "@/lib/prospeccao/render";

const matricula = {
  linkBase: "https://www.alemfilmes.com.br/institucional",
  linkAppendsSchoolParam: true,
  caseText: null,
};

// 10/10/2026 10:00 em Fortaleza (13:00 UTC).
const morning = new Date("2026-10-10T13:00:00Z");

describe("greetingFor", () => {
  it("Bom dia até 11h59, Boa tarde até 17h59, Boa noite depois", () => {
    assert.equal(greetingFor(0), "Bom dia");
    assert.equal(greetingFor(11), "Bom dia");
    assert.equal(greetingFor(12), "Boa tarde");
    assert.equal(greetingFor(17), "Boa tarde");
    assert.equal(greetingFor(18), "Boa noite");
    assert.equal(greetingFor(23), "Boa noite");
  });
});

describe("playbookLink", () => {
  it("acrescenta ?escola= com o nome codificado", () => {
    assert.equal(playbookLink(matricula, "Colégio Exemplo"), "https://www.alemfilmes.com.br/institucional?escola=Col%C3%A9gio%20Exemplo");
  });

  it("usa & quando a URL já tem parâmetros", () => {
    assert.equal(playbookLink({ linkBase: "https://x.com/p?a=1", linkAppendsSchoolParam: true }, "A&B"), "https://x.com/p?a=1&escola=A%26B");
  });

  it("não mexe no link quando o playbook não pede o parâmetro", () => {
    assert.equal(playbookLink({ linkBase: "www.alemfilmes.com.br", linkAppendsSchoolParam: false }, "Colégio"), "www.alemfilmes.com.br");
  });

  it("URL pendente vira link vazio", () => {
    assert.equal(playbookLink({ linkBase: "  ", linkAppendsSchoolParam: true }, "Colégio"), "");
  });
});

describe("renderScript", () => {
  it("preenche as variáveis do Toque 1 do playbook 1", () => {
    const result = renderScript(
      "{nome}, tudo bem? Vi o perfil do {escola} e {gancho}. A campanha de {ano_seguinte} de vocês já está em produção?",
      { now: morning, decisionMakerName: "Mariana Souza", leadName: "Colégio Exemplo", hook: "vi a unidade nova", playbook: matricula },
    );
    assert.equal(result.text, "Mariana, tudo bem? Vi o perfil do Colégio Exemplo e vi a unidade nova. A campanha de 2027 de vocês já está em produção?");
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.unknown, []);
  });

  it("mantém as quebras de linha", () => {
    const result = renderScript("{saudacao}.\n\nLinha dois\r\nLinha três", { now: morning });
    assert.equal(result.text, "Bom dia.\n\nLinha dois\r\nLinha três");
  });

  it("saudação pelo horário de Fortaleza, não UTC", () => {
    // 21:30 UTC = 18:30 em Fortaleza.
    assert.equal(renderScript("{saudacao}", { now: new Date("2026-10-10T21:30:00Z") }).text, "Boa noite");
    // 14:59 UTC = 11:59 em Fortaleza.
    assert.equal(renderScript("{saudacao}", { now: new Date("2026-10-10T14:59:00Z") }).text, "Bom dia");
  });

  it("{mês} é o mês seguinte, por extenso e minúsculo, e vira o ano em dezembro", () => {
    assert.equal(renderScript("{mês}", { now: morning }).text, "novembro");
    assert.equal(renderScript("{mês} {ano_seguinte}", { now: new Date("2026-12-15T15:00:00Z") }).text, "janeiro 2027");
    // 31/12 às 22h em Fortaleza ainda é dezembro (01/01 em UTC).
    assert.equal(renderScript("{mês} {ano_seguinte}", { now: new Date("2027-01-01T01:00:00Z") }).text, "janeiro 2027");
  });

  it("lista as variáveis sem valor e deixa o marcador no texto", () => {
    const result = renderScript("{nome}, veja: {link} e {ultimo_projeto}", { now: morning, leadName: "Colégio", playbook: { ...matricula, linkBase: "" } });
    assert.equal(result.text, "{nome}, veja: {link} e {ultimo_projeto}");
    assert.deepEqual(result.missing, ["nome", "link", "ultimo_projeto"]);
  });

  it("aponta variável desconhecida sem quebrar o resto", () => {
    const result = renderScript("{nom}, oi {empresa}", { now: morning, leadName: "Acme" });
    assert.equal(result.text, "{nom}, oi Acme");
    assert.deepEqual(result.unknown, ["nom"]);
    assert.deepEqual(result.missing, []);
  });

  it("{case} vem do playbook", () => {
    const result = renderScript("Filmamos eventos como {case}.", { now: morning, playbook: { linkBase: "", linkAppendsSchoolParam: false, caseText: "o MotoGP" } });
    assert.equal(result.text, "Filmamos eventos como o MotoGP.");
  });

  it("corpo vazio (reativação ainda não escrita) não quebra", () => {
    assert.deepEqual(renderScript("", { now: morning }), { text: "", missing: [], unknown: [] });
  });
});

describe("placeholders", () => {
  it("lista sem repetir e separa as desconhecidas", () => {
    assert.deepEqual(placeholdersIn("{nome} {nome} {mês} {xpto}"), ["nome", "mês", "xpto"]);
    assert.deepEqual(unknownPlaceholders("{nome} {mes} {ano}"), ["mes", "ano"]);
  });
});
