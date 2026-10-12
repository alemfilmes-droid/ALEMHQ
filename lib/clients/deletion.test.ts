import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/clients/deletion-cases.json";
import {
  confirmationMatches,
  deletedClientLabel,
  dependencyLines,
  hasDependencies,
  PURGE_BLOCKED_FINANCE,
  PURGE_BLOCKED_GOALS,
  purgeBlocker,
  type DeletionCounts,
} from "@/lib/clients/deletion";

const ZERO: DeletionCounts = {
  projects_total: 0,
  projects_active: 0,
  pautas_open: 0,
  deals_total: 0,
  deals_open: 0,
  cadences_active: 0,
  meetings_future: 0,
  meetings_past: 0,
  budgets: 0,
  goal_contributions: 0,
  receivables_open: 0,
  receivables_paid: 0,
  receivables_cancelled: 0,
  payables_open: 0,
  payables_paid: 0,
  payables_cancelled: 0,
  contacts: 0,
};

/** Os mesmos casos são conferidos contra public.client_deletion_flags no banco (validação da migração). */
describe("excluir cliente: Lixeira ou apagar de vez", () => {
  for (const item of cases) {
    it(item.name, () => {
      const counts = { ...ZERO, ...item.counts };
      assert.equal(hasDependencies(counts), item.has_dependencies);
      assert.equal(purgeBlocker(counts) === null, item.can_purge);
    });
  }

  it("financeiro trava antes das metas, com a frase pedida", () => {
    assert.equal(purgeBlocker({ ...ZERO, receivables_paid: 1, goal_contributions: 1 }), PURGE_BLOCKED_FINANCE);
    assert.equal(purgeBlocker({ ...ZERO, goal_contributions: 1 }), PURGE_BLOCKED_GOALS);
    assert.equal(PURGE_BLOCKED_FINANCE, "Este cliente tem lançamentos financeiros e não pode ser apagado definitivamente.");
  });
});

describe("confirmação por digitação", () => {
  it("aceita o nome exato, ignorando espaços nas pontas e repetidos", () => {
    assert.ok(confirmationMatches("  Escola  Modelo ", "Escola Modelo"));
  });
  it("recusa nome diferente, maiúsculas diferentes ou vazio", () => {
    assert.ok(!confirmationMatches("escola modelo", "Escola Modelo"));
    assert.ok(!confirmationMatches("Escola", "Escola Modelo"));
    assert.ok(!confirmationMatches("   ", ""));
  });
});

describe("relatórios do financeiro", () => {
  it("cliente excluído aparece com a marca; os valores não passam por aqui", () => {
    assert.equal(deletedClientLabel("Escola Modelo", "2026-10-12T12:00:00Z"), "Escola Modelo (cliente excluído)");
    assert.equal(deletedClientLabel("Escola Modelo", null), "Escola Modelo");
  });
});

describe("resumo em português", () => {
  it("só mostra o que existe, com singular e plural", () => {
    assert.deepEqual(
      dependencyLines({ ...ZERO, projects_total: 3, projects_active: 1, deals_total: 1, cadences_active: 1, meetings_future: 1, meetings_past: 2, receivables_paid: 2, payables_open: 1 }),
      [
        "3 projetos (1 ativo)",
        "1 negócio no CRM (1 com cadência ativa)",
        "1 reunião futura, 2 reuniões passadas",
        "Recebimentos: 2 recebidos",
        "Pagamentos: 1 em aberto",
      ],
    );
  });
  it("cliente sem histórico: lista vazia", () => {
    assert.deepEqual(dependencyLines({ ...ZERO, contacts: 2 }), []);
  });
});
