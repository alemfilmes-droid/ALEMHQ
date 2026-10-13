import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Tabelas com leitura liberada COLUNA A COLUNA para `authenticated` (deals, deal_proposals, deal_negotiations —
 * para esconder valores). Coluna nova sem `grant select (...)` derruba qualquer tela que a leia, para qualquer
 * pessoa logada (erro 42501). Aqui: as colunas liberadas, lidas das migrações, e as colunas que o código pede.
 * Usado pelo teste lib/crm/column-grants.test.ts.
 */

const REVOKE = /revoke\s+select\s+on\s+public\.(\w+)\s+from\s+[^;]*\bauthenticated\b/gi;
const GRANT_COLUMNS = /grant\s+select\s*\(([^)]*)\)\s*on\s+public\.(\w+)\s+to\s+[^;]*\bauthenticated\b/gi;

/** Colunas que `authenticated` pode ler em cada tabela restrita, aplicando as migrações em ordem. */
export function grantedColumns(migrations: readonly { name: string; sql: string }[]): Map<string, Set<string>> {
  const granted = new Map<string, Set<string>>();
  for (const { sql } of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    const text = sql.replace(/--[^\n]*/g, "");
    const events: { at: number; apply: () => void }[] = [];
    for (const match of text.matchAll(REVOKE)) {
      const table = match[1]!.toLowerCase();
      events.push({ at: match.index, apply: () => granted.set(table, new Set()) });
    }
    for (const match of text.matchAll(GRANT_COLUMNS)) {
      const table = match[2]!.toLowerCase();
      const columns = match[1]!.split(",").map((column) => column.trim().toLowerCase()).filter(Boolean);
      events.push({
        at: match.index,
        apply: () => {
          const set = granted.get(table) ?? new Set<string>();
          for (const column of columns) set.add(column);
          granted.set(table, set);
        },
      });
    }
    for (const event of events.sort((a, b) => a.at - b.at)) event.apply();
  }
  return granted;
}

/** Colunas de uma string do `.select()` do Supabase: ignora relações embutidas (`company:companies(name)`) e apelidos. */
export function selectColumns(select: string): string[] {
  let flat = select;
  // Remove as relações embutidas, de dentro para fora.
  for (let previous = ""; previous !== flat; ) {
    previous = flat;
    flat = flat.replace(/[\w:!.]+\s*\([^()]*\)/g, "");
  }
  return flat
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(":") ? part.split(":").pop()!.trim() : part).replace(/::\w+$/, "").toLowerCase());
}

export interface SelectUse {
  file: string;
  table: string;
  columns: string[];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".")) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

/**
 * Leituras das tabelas restritas no código (`.from("tabela")` … `.select(...)`). O argumento pode ser uma string
 * ou uma constante `const NOME = "..."` definida em qualquer arquivo do projeto.
 */
export function selectUses(root: string, tables: readonly string[]): SelectUse[] {
  const files = ["app", "features", "lib", "components"].flatMap((dir) => sourceFiles(join(root, dir)));
  const sources = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));
  const constants = new Map<string, string>();
  for (const { text } of sources) {
    for (const match of text.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'`]([^"'`]*)["'`]/g)) constants.set(match[1]!, match[2]!);
  }

  const uses: SelectUse[] = [];
  for (const { file, text } of sources) {
    for (const match of text.matchAll(/\.from\(\s*["'](\w+)["']\s*\)/g)) {
      const table = match[1]!;
      if (!tables.includes(table)) continue;
      // A cadeia desta consulta: até o próximo .from( ou o fim da instrução.
      const rest = text.slice(match.index + match[0].length);
      const chain = rest.slice(0, Math.min(...[rest.search(/\.from\(/), rest.search(/;\s*\n/)].filter((at) => at >= 0), rest.length));
      const columns: string[] = [];
      // Colunas devolvidas (inclusive em update/insert … .select()).
      for (const select of chain.matchAll(/\.select\(\s*(?:["'`]([^"'`]*)["'`]|([A-Z_][A-Z0-9_]*))/g)) {
        const value = select[1] ?? constants.get(select[2]!);
        if (value === undefined) throw new Error(`${file}: constante ${select[2]} não encontrada para o select de ${table}.`);
        columns.push(...selectColumns(value));
      }
      // Filtros e ordenação também exigem leitura da coluna.
      for (const filter of chain.matchAll(/\.(?:eq|neq|is|not|in|gt|gte|lt|lte|like|ilike|contains|containedBy|order)\(\s*["'](\w+)["']/g)) {
        columns.push(filter[1]!.toLowerCase());
      }
      uses.push({ file, table, columns: [...new Set(columns)] });
    }
  }
  return uses;
}

export function readMigrations(root: string): { name: string; sql: string }[] {
  const dir = join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
}
