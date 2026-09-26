/**
 * Zera os dados operacionais do Além HQ para começar o uso real. IRREVERSÍVEL.
 *
 * Uso:
 *   npm run reset-data -- --keep-email=voce@alemfilmes.com --dry-run
 *   npm run reset-data -- --keep-email=voce@alemfilmes.com --confirm=APAGAR-TUDO
 *
 * Flags:
 *   --keep-email=<e-mail>   Obrigatório. A conta admin que fica (precisa existir e ser admin).
 *   --dry-run               Só conta o que seria apagado. Não grava nada.
 *   --confirm=APAGAR-TUDO   Obrigatório para apagar de verdade (texto exato).
 *   --remove-other-users    Também apaga as contas REAIS que não são a mantida. Sem esta flag, só as
 *                           contas de demonstração (@alemdemo.invalid) são removidas; as demais
 *                           ficam e são listadas no fim.
 *
 * APAGA (nesta ordem, respeitando as chaves estrangeiras):
 *   avisos e leituras → compromissos da agenda → CRM (atividades, interações, reuniões, negociações,
 *   propostas, qualificação) → pautas (comentários, membros, histórico) → recebimentos e pagamentos →
 *   equipe, financeiro e projetos → negócios → contatos e empresas → banco de horas (registros) →
 *   contadores de código (pautas e CRM recomeçam do 1) → notificações e log de atividades → logos
 *   de clientes no Storage → contas de demonstração (e, com a flag, outras contas).
 *
 * MANTÉM: a estrutura do banco (tabelas, funções, RLS), company_settings, commission_rules,
 * deal_stage_probabilities, a conta admin informada (profile, squads, jornada, preferências) e os
 * convites pendentes.
 *
 * Usa a service role de .env.local (ignora RLS). O projeto-alvo é impresso antes de qualquer escrita.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../types/database";

config({ path: ".env.local" });
config();

type TableName = keyof Database["public"]["Tables"];

const env = z
  .object({ NEXT_PUBLIC_SUPABASE_URL: z.string().url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) })
  .safeParse(process.env);
if (!env.success) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
  process.exit(1);
}

const CONFIRM_PHRASE = "APAGAR-TUDO";
const DEMO_EMAIL_DOMAIN = "@alemdemo.invalid";
const LOGO_BUCKET = "company-logos";
const AVATAR_BUCKET = "avatars";

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
const hasFlag = (name: string) => process.argv.slice(2).includes(`--${name}`);

const keepEmail = z.string().email().safeParse(flag("keep-email")?.trim().toLowerCase());
const dryRun = hasFlag("dry-run");
const confirmed = flag("confirm") === CONFIRM_PHRASE;
const removeOtherUsers = hasFlag("remove-other-users");

if (!keepEmail.success) {
  console.error("Informe a conta que fica: --keep-email=voce@alemfilmes.com");
  process.exit(1);
}
if (!dryRun && !confirmed) {
  console.error(`Nada foi apagado. Para apagar de verdade, rode com --confirm=${CONFIRM_PHRASE} (ou use --dry-run para só contar).`);
  process.exit(1);
}

const supabase = createClient<Database>(env.data.NEXT_PUBLIC_SUPABASE_URL, env.data.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Tabelas operacionais, na ordem de exclusão (filhas antes das mães). `column` é uma coluna sempre
 * preenchida, usada só porque o PostgREST exige um filtro em DELETE.
 */
const STEPS: { table: TableName; column: string; label: string }[] = [
  { table: "announcement_reads", column: "announcement_id", label: "Leituras de avisos" },
  { table: "announcements", column: "id", label: "Avisos" },
  { table: "commitments", column: "id", label: "Compromissos da agenda" },
  { table: "deal_activities", column: "id", label: "CRM — atividades" },
  { table: "deal_interactions", column: "id", label: "CRM — interações" },
  { table: "deal_meetings", column: "id", label: "CRM — reuniões" },
  { table: "deal_negotiations", column: "id", label: "CRM — negociações" },
  { table: "deal_proposals", column: "id", label: "CRM — propostas" },
  { table: "deal_qualification", column: "deal_id", label: "CRM — qualificação" },
  { table: "pauta_comments", column: "id", label: "Pautas — comentários" },
  { table: "pauta_members", column: "pauta_id", label: "Pautas — responsáveis" },
  { table: "pauta_status_history", column: "id", label: "Pautas — histórico" },
  { table: "pautas", column: "id", label: "Pautas e tarefas avulsas" },
  { table: "receivables", column: "id", label: "Recebimentos" },
  { table: "payables", column: "id", label: "Pagamentos" },
  { table: "project_members", column: "project_id", label: "Projetos — equipe" },
  { table: "project_financials", column: "project_id", label: "Projetos — financeiro" },
  { table: "projects", column: "id", label: "Projetos" },
  { table: "deals", column: "id", label: "CRM — negócios" },
  { table: "contacts", column: "id", label: "Contatos" },
  { table: "companies", column: "id", label: "Empresas (clientes e prospects)" },
  { table: "time_entries", column: "id", label: "Banco de horas — registros de ponto" },
  { table: "pauta_code_counters", column: "year", label: "Contador de códigos de pauta" },
  { table: "crm_code_counters", column: "year", label: "Contador de códigos do CRM" },
  // Por último: alguns gatilhos registram atividade/notificação ao mexer nas tabelas acima.
  { table: "notifications", column: "id", label: "Notificações" },
  { table: "activity_log", column: "id", label: "Log de atividades" },
];

const KEPT_TABLES: { table: TableName; label: string }[] = [
  { table: "profiles", label: "Contas (profiles)" },
  { table: "profile_squads", label: "Squads das contas" },
  { table: "work_schedules", label: "Jornadas" },
  { table: "user_settings", label: "Preferências de notificação" },
  { table: "company_settings", label: "Configurações da empresa" },
  { table: "commission_rules", label: "Regras de comissão" },
  { table: "deal_stage_probabilities", label: "Probabilidades por etapa" },
  { table: "invitations", label: "Convites" },
];

function isMissingTable(error: { code?: string; message: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|Could not find the table/i.test(error.message)));
}

async function count(table: TableName): Promise<number | null> {
  const { count: total, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (isMissingTable(error)) return null;
  if (error) throw new Error(`contar ${table}: ${error.message}`);
  return total ?? 0;
}

async function wipe(step: (typeof STEPS)[number]): Promise<number | null> {
  const { count: deleted, error } = await supabase.from(step.table).delete({ count: "exact" }).not(step.column, "is", null);
  if (isMissingTable(error)) return null;
  if (error) throw new Error(`apagar ${step.table}: ${error.message}`);
  return deleted ?? 0;
}

async function listStorageFiles(bucket: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`listar ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // Pastas vêm sem id no Storage do Supabase.
      if (item.id === null) files.push(...(await listStorageFiles(bucket, path)));
      else files.push(path);
    }
    if (data.length < 1000) break;
  }
  return files;
}

async function removeStorageFiles(bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw new Error(`remover arquivos de ${bucket}: ${error.message}`);
  }
}

async function listAuthUsers() {
  const users: { id: string; email: string }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listar contas: ${error.message}`);
    users.push(...data.users.map((user) => ({ id: user.id, email: (user.email ?? "").toLowerCase() })));
    if (data.users.length < 1000) break;
  }
  return users;
}

function pad(label: string) {
  return label.padEnd(44, " ");
}

async function main() {
  console.log(`\nProjeto-alvo: ${env.data!.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(dryRun ? "Modo: SIMULAÇÃO (--dry-run) — nada será apagado.\n" : "Modo: APAGAR DE VERDADE.\n");

  // 1. A conta mantida precisa existir e ser admin — antes de qualquer escrita.
  const { data: keeper, error: keeperError } = await supabase
    .from("profiles")
    .select("id, email, full_name, access_role, org_level")
    .eq("email", keepEmail.data!)
    .maybeSingle();
  if (keeperError) throw new Error(`buscar conta mantida: ${keeperError.message}`);
  if (!keeper) throw new Error(`Nenhuma conta com o e-mail ${keepEmail.data}. Nada foi apagado.`);
  if (keeper.access_role !== "admin") throw new Error(`${keeper.email} não é admin. Nada foi apagado.`);
  console.log(`Conta mantida: ${keeper.full_name || "(sem nome)"} <${keeper.email}>\n`);

  // 2. Contas a remover.
  const authUsers = await listAuthUsers();
  const others = authUsers.filter((user) => user.id !== keeper.id);
  const demoUsers = others.filter((user) => user.email.endsWith(DEMO_EMAIL_DOMAIN));
  const realOthers = others.filter((user) => !user.email.endsWith(DEMO_EMAIL_DOMAIN));
  const usersToRemove = removeOtherUsers ? others : demoUsers;

  // 3. Arquivos no Storage.
  const logoFiles = await listStorageFiles(LOGO_BUCKET);
  const avatarFiles = (await Promise.all(usersToRemove.map((user) => listStorageFiles(AVATAR_BUCKET, user.id)))).flat();

  if (dryRun) {
    console.log("Seria apagado:");
    for (const step of STEPS) {
      const total = await count(step.table);
      console.log(`  ${pad(step.label)} ${total === null ? "tabela não existe (migração não aplicada)" : total}`);
    }
    console.log(`  ${pad("Logos de clientes (Storage)")} ${logoFiles.length} arquivo(s)`);
    console.log(`  ${pad("Contas removidas")} ${usersToRemove.length} (${usersToRemove.map((user) => user.email).join(", ") || "nenhuma"})`);
    if (!removeOtherUsers && realOthers.length > 0) {
      console.log(`\nContas reais que FICARIAM (use --remove-other-users para apagar): ${realOthers.map((user) => user.email).join(", ")}`);
    }
    console.log(`\nNada foi apagado. Para executar: --confirm=${CONFIRM_PHRASE}`);
    return;
  }

  // 4. Tabelas operacionais, na ordem das FKs.
  console.log("Apagado:");
  const summary: { label: string; result: string }[] = [];
  for (const step of STEPS) {
    const deleted = await wipe(step);
    const result = deleted === null ? "tabela não existe (migração não aplicada)" : String(deleted);
    summary.push({ label: step.label, result });
    console.log(`  ${pad(step.label)} ${result}`);
  }

  // 5. Storage: logos de clientes (as empresas já foram apagadas) e fotos das contas removidas.
  await removeStorageFiles(LOGO_BUCKET, logoFiles);
  console.log(`  ${pad("Logos de clientes (Storage)")} ${logoFiles.length} arquivo(s)`);

  // 6. Contas: apagar o usuário do Auth leva o profile, squads, jornada e preferências em cascata.
  await removeStorageFiles(AVATAR_BUCKET, avatarFiles);
  for (const user of usersToRemove) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`apagar conta ${user.email}: ${error.message}`);
  }
  console.log(`  ${pad("Contas removidas")} ${usersToRemove.length}${usersToRemove.length ? ` (${usersToRemove.map((user) => user.email).join(", ")})` : ""}`);

  // 7. A conta mantida vira master (o master de demonstração pode ter saído) e fica na diretoria.
  const { data: currentMaster } = await supabase.from("profiles").select("id").eq("org_level", "master").maybeSingle();
  if (!currentMaster) {
    const { error } = await supabase.from("profiles").update({ org_level: "master", is_active: true }).eq("id", keeper.id);
    if (error) throw new Error(`promover a master: ${error.message}`);
    console.log(`\n${keeper.email} agora é o master.`);
  }
  const { error: squadError } = await supabase
    .from("profile_squads")
    .upsert({ profile_id: keeper.id, squad: "diretoria", is_lead: false }, { onConflict: "profile_id,squad", ignoreDuplicates: true });
  if (squadError) throw new Error(`garantir squad diretoria: ${squadError.message}`);

  // 8. O que ficou.
  console.log("\nFicou:");
  for (const kept of KEPT_TABLES) {
    const total = await count(kept.table);
    console.log(`  ${pad(kept.label)} ${total === null ? "tabela não existe (migração não aplicada)" : total}`);
  }
  if (!removeOtherUsers && realOthers.length > 0) {
    console.log(`\nContas reais mantidas (use --remove-other-users para apagar): ${realOthers.map((user) => user.email).join(", ")}`);
  }
  console.log("\nPronto. Estrutura, configurações e a conta admin foram preservadas.");
}

main().catch((error: unknown) => {
  console.error(`\nFalhou: ${error instanceof Error ? error.message : String(error)}`);
  console.error("O que já tinha sido apagado até aqui continua apagado; rode de novo para concluir (o script é idempotente).");
  process.exit(1);
});
