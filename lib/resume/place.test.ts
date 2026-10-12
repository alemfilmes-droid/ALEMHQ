import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RESUME_MAX_AGE_MS, isResumableRoute, parseSavedPlace, resumeTarget } from "@/lib/resume/place";

const NOW = 1_800_000_000_000;
const base = { standalone: true, freshLaunch: true, pathname: "/inicio", now: NOW };

describe("resumeTarget", () => {
  it("app reaberto pelo iOS volta para Pautas com os filtros", () => {
    const saved = { route: "/minhas-pautas?visao=quadro&agrupar=status", at: NOW - 60_000 };
    assert.equal(resumeTarget({ ...base, saved }), "/minhas-pautas?visao=quadro&agrupar=status");
  });

  it("no navegador comum (não é o app da tela de início) não redireciona", () => {
    assert.equal(resumeTarget({ ...base, standalone: false, saved: { route: "/pautas", at: NOW } }), null);
  });

  it("só na primeira tela da abertura, nunca no meio do uso", () => {
    assert.equal(resumeTarget({ ...base, freshLaunch: false, saved: { route: "/pautas", at: NOW } }), null);
  });

  it("lugar antigo (mais de 12 h) não é reaberto", () => {
    assert.equal(resumeTarget({ ...base, saved: { route: "/pautas", at: NOW - RESUME_MAX_AGE_MS - 1 } }), null);
  });

  it("abriu por link de notificação (não caiu no Início): respeita o link", () => {
    assert.equal(resumeTarget({ ...base, pathname: "/financeiro", saved: { route: "/pautas", at: NOW } }), null);
  });
});

describe("isResumableRoute / parseSavedPlace", () => {
  it("não reabre login nem impressão", () => {
    assert.equal(isResumableRoute("/login"), false);
    assert.equal(isResumableRoute("/orcamentos/abc/apresentacao"), false);
    assert.equal(isResumableRoute("/pautas?squad=financeiro"), true);
  });

  it("valor corrompido é ignorado", () => {
    assert.equal(parseSavedPlace("{x"), null);
    assert.deepEqual(parseSavedPlace(JSON.stringify({ route: "/pautas", at: 1 })), { route: "/pautas", at: 1 });
  });
});
