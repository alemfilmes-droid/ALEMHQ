import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { grantedColumns, readMigrations, selectColumns, selectUses } from "@/lib/crm/column-grants";

const ROOT = process.cwd();
const RESTRICTED = ["deals", "deal_proposals", "deal_negotiations"] as const;

/**
 * CRM como SDR: a pessoa do comercial (SDR) lê o CRM com o papel `authenticated`, e nessas tabelas só as colunas
 * liberadas uma a uma. Se o código pedir (no select ou num filtro) uma coluna sem `grant select`, a página cai com
 * 42501 para ela — foi o que derrubou Leads › Chamar hoje em 13/10/2026 (prospect_override_*, prospect_removed_at).
 */
describe("CRM como SDR: só lê colunas liberadas", () => {
  const granted = grantedColumns(readMigrations(ROOT));
  const uses = selectUses(ROOT, RESTRICTED);

  it("as tabelas restritas existem nas migrações", () => {
    for (const table of RESTRICTED) assert.ok(granted.get(table)?.size, `${table} sem colunas liberadas`);
  });

  it("encontra as leituras do CRM e da prospecção (inclusive a fila Chamar hoje)", () => {
    assert.ok(uses.some((use) => use.file.endsWith("cadence-queries.ts") && use.columns.includes("prospect_override_at")));
  });

  for (const table of RESTRICTED) {
    it(`toda coluna lida de ${table} está liberada para quem está logado`, () => {
      const missing = uses
        .filter((use) => use.table === table)
        .flatMap((use) => use.columns.filter((column) => column !== "*" && !granted.get(table)?.has(column)).map((column) => `${use.file.replace(`${ROOT}/`, "")}: ${column}`));
      assert.deepEqual(missing, [], `Colunas sem "grant select (...) on public.${table} to authenticated":\n${missing.join("\n")}`);
    });
  }

  it("valores continuam escondidos", () => {
    assert.equal(granted.get("deals")?.has("estimated_value"), false);
    assert.equal(granted.get("deal_proposals")?.has("amount"), false);
  });
});

describe("leitura do select do Supabase", () => {
  it("ignora relações embutidas e apelidos", () => {
    assert.deepEqual(selectColumns("id, title, company:companies(name, logo:logos(url)), owner:owner_id"), ["id", "title", "owner_id"]);
    assert.deepEqual(selectColumns("prospect_playbook_id, company:companies!inner(name)"), ["prospect_playbook_id"]);
  });

  it("aplica revoke e grants em ordem", () => {
    const granted = grantedColumns([
      { name: "2", sql: "grant select (b) on public.t to authenticated;" },
      { name: "1", sql: "revoke select on public.t from authenticated, anon;\ngrant select (a) on public.t to authenticated;" },
      { name: "3", sql: "-- grant select (c) on public.t to authenticated;" },
    ]);
    assert.deepEqual([...(granted.get("t") ?? [])], ["a", "b"]);
  });
});
