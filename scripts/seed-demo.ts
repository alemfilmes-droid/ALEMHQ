/**
 * Dados de demonstração — DESLIGADO do uso normal: não há script do npm para ele e nada o chama.
 * O sistema está em uso real; só rode manualmente num projeto Supabase de testes:
 *
 *   npx tsx scripts/seed-demo.ts --yes      cria (ou recria) os dados de demonstração
 *   npx tsx scripts/seed-demo.ts --clean    remove somente os dados de demonstração
 *
 * Tudo que é criado começa com "[Demo]", e é só isso que a limpeza apaga.
 * Usa a service role de .env.local. O alvo é impresso antes de qualquer escrita.
 */
import { deflateSync } from "node:zlib";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { centsToNumber, splitInstallments } from "../features/finance/money";
import { toIsoFromLocal } from "../features/time-tracking/format";
import type { Database } from "../types/database";

config({ path: ".env.local" });
config();

type Tables = Database["public"]["Tables"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const env = z
  .object({ NEXT_PUBLIC_SUPABASE_URL: z.string().url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) })
  .safeParse(process.env);
if (!env.success) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const wantsClean = args.has("--clean");
const confirmed = args.has("--yes");
if (!wantsClean && !confirmed) {
  console.error("Este comando grava dados de demonstração. Rode com --yes para confirmar ou --clean para remover.");
  process.exit(1);
}

const supabase = createClient<Database>(env.data.NEXT_PUBLIC_SUPABASE_URL, env.data.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PREFIX = "[Demo]";

function isoDay(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Dia `day` do mês `monthsFromNow` meses a partir de hoje (ex.: -11 = 11 meses atrás). */
function monthDay(monthsFromNow: number, day = 10) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + monthsFromNow);
  date.setUTCDate(day);
  return date.toISOString().slice(0, 10);
}

function fail(step: string, error: { message: string } | null) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function clean() {
  // Agenda: compromissos de demonstração (os gerados por reuniões do CRM saem em cascata com o negócio).
  fail("commitments", (await supabase.from("commitments").delete().like("title", `${PREFIX}%`)).error);
  // Logos dos clientes de demonstração no Storage (a linha em companies sai logo abaixo).
  const { data: demoCompanies } = await supabase.from("companies").select("id").like("name", `${PREFIX}%`);
  if (demoCompanies && demoCompanies.length > 0) {
    await supabase.storage.from(LOGO_BUCKET).remove(demoCompanies.map((company) => `${company.id}/logo.png`));
  }
  // Ordem respeita as FKs: financeiro → pautas (cascata leva membros/comentários/histórico) →
  // equipe do projeto → projetos → empresas (contatos em cascata) → banco de horas (independente).
  fail("time_entries", (await supabase.from("time_entries").delete().like("note", `${PREFIX}%`)).error);
  fail("payables", (await supabase.from("payables").delete().like("description", `${PREFIX}%`)).error);
  fail("receivables", (await supabase.from("receivables").delete().like("description", `${PREFIX}%`)).error);
  fail("pautas", (await supabase.from("pautas").delete().like("title", `${PREFIX}%`)).error);
  const { data: staleProjects } = await supabase.from("projects").select("id").like("name", `${PREFIX}%`);
  if (staleProjects && staleProjects.length > 0) {
    const ids = staleProjects.map((p) => p.id);
    fail("project_members", (await supabase.from("project_members").delete().in("project_id", ids)).error);
  }
  fail("projects", (await supabase.from("projects").delete().like("name", `${PREFIX}%`)).error);
  // Pautas geradas pelo CRM (título não começa com o prefixo) saem pelo vínculo com o negócio.
  const { data: staleDeals } = await supabase.from("deals").select("id").like("title", `${PREFIX}%`);
  if (staleDeals && staleDeals.length > 0) {
    fail("pautas (CRM)", (await supabase.from("pautas").delete().in("deal_id", staleDeals.map((d) => d.id))).error);
  }
  // Cascata: qualificação, interações, propostas, negociações, reuniões e compromissos somem junto.
  fail("deals", (await supabase.from("deals").delete().like("title", `${PREFIX}%`)).error);
  fail("companies", (await supabase.from("companies").delete().like("name", `${PREFIX}%`)).error);
  console.log("Dados de demonstração removidos.");
}

async function insertCompany(row: Tables["companies"]["Insert"]) {
  const { data, error } = await supabase.from("companies").insert(row).select("id").single();
  if (error) throw new Error(`companies: ${error.message}`);
  return data.id;
}

async function insertProject(row: Tables["projects"]["Insert"]) {
  const { data, error } = await supabase.from("projects").insert(row).select("id").single();
  if (error) throw new Error(`projects: ${error.message}`);
  return data.id;
}

async function insertPauta(row: Tables["pautas"]["Insert"]) {
  const { data, error } = await supabase.from("pautas").insert(row).select("id").single();
  if (error) throw new Error(`pautas: ${error.message}`);
  return data.id;
}

function receivable(
  companyId: string,
  projectId: string | null,
  description: string,
  cents: number,
  dueOffset: number,
  extra: Partial<Tables["receivables"]["Insert"]> = {},
): Tables["receivables"]["Insert"] {
  return {
    company_id: companyId,
    project_id: projectId,
    description: `${PREFIX} ${description}`,
    amount: centsToNumber(cents),
    due_date: isoDay(dueOffset),
    ...extra,
  };
}

function received(cents: number, receivedOffset: number, method: PaymentMethod, invoice: string) {
  return {
    received_at: isoDay(receivedOffset),
    received_amount: centsToNumber(cents),
    payment_method: method,
    invoice_number: invoice,
  } satisfies Partial<Tables["receivables"]["Insert"]>;
}

/** Diretor usado como responsável dos projetos de demonstração (a migração já coloca todo admin na diretoria). */
async function pickOwner(): Promise<string> {
  const { data } = await supabase.from("profile_squads").select("profile_id").eq("squad", "diretoria").limit(1).maybeSingle();
  if (data) return data.profile_id;
  const { data: admin } = await supabase.from("profiles").select("id").eq("access_role", "admin").limit(1).maybeSingle();
  if (!admin) throw new Error("Nenhum admin encontrado. Crie o primeiro admin antes de rodar o seed.");
  return admin.id;
}

/**
 * Time ativo para variar líder/responsável das pautas. Numa conta nova, só existe o admin —
 * as pautas então repetem essa mesma pessoa, o que ainda funciona, só menos variado visualmente.
 */
async function pickTeam(owner: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("id").eq("is_active", true).neq("full_name", "").order("full_name");
  const ids = (data ?? []).map((row) => row.id);
  return ids.length > 0 ? ids : [owner];
}

// ---------------------------------------------------------------------------
// Contas de demonstração da hierarquia: um login de verdade por nível, para testar /pautas e
// /minhas-pautas de pontos de vista diferentes. Não são removidas pelo --clean (são contas de
// equipe, não dados de negócio) — rodar o seed de novo apenas atualiza cargo/nível/squads.
// ---------------------------------------------------------------------------

export const DEMO_LOGIN_PASSWORD = "AlemDemo123!";

interface DemoUserSpec {
  email: string;
  fullName: string;
  jobTitle: string;
  accessRole: Tables["profiles"]["Row"]["access_role"];
  functions: Tables["profiles"]["Row"]["functions"];
  squads: Database["public"]["Enums"]["squad"][];
  /** Squads em que a pessoa é líder (profile_squads.is_lead). */
  leadSquads?: Database["public"]["Enums"]["squad"][];
  orgLevel: Database["public"]["Enums"]["org_level"];
}

async function ensureDemoUser(spec: DemoUserSpec): Promise<string> {
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", spec.email).maybeSingle();

  let profileId = existing?.id ?? null;
  if (!profileId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: spec.email,
      password: DEMO_LOGIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName },
    });
    if (error || !created.user) throw new Error(`auth (${spec.email}): ${error?.message ?? "falha desconhecida"}`);
    profileId = created.user.id;
  }

  // org_level='master' é único no banco — só promove a este login se não houver master ainda,
  // para nunca destronar um master real ao rodar o seed num ambiente já em uso.
  let orgLevel = spec.orgLevel;
  if (orgLevel === "master") {
    const { data: currentMaster } = await supabase.from("profiles").select("id").eq("org_level", "master").maybeSingle();
    if (currentMaster && currentMaster.id !== profileId) orgLevel = "diretoria";
  }

  fail(
    "profiles (demo)",
    (
      await supabase
        .from("profiles")
        .update({
          full_name: spec.fullName,
          job_title: spec.jobTitle,
          access_role: spec.accessRole,
          functions: spec.functions,
          org_level: orgLevel,
          is_active: true,
        })
        .eq("id", profileId)
    ).error,
  );

  fail("profile_squads (demo, limpeza)", (await supabase.from("profile_squads").delete().eq("profile_id", profileId)).error);
  if (spec.squads.length > 0) {
    fail(
      "profile_squads (demo)",
      (
        await supabase
          .from("profile_squads")
          .insert(spec.squads.map((squad) => ({ profile_id: profileId!, squad, is_lead: spec.leadSquads?.includes(squad) ?? false })))
      ).error,
    );
  }

  return profileId;
}

async function seedHierarchyDemoUsers() {
  const ceo = await ensureDemoUser({
    email: "demo.ceo@alemdemo.invalid",
    fullName: "[Demo] Marina Alencar",
    jobTitle: "CEO",
    accessRole: "admin",
    functions: [],
    squads: ["diretoria"],
    orgLevel: "master",
  });
  const headAudiovisual = await ensureDemoUser({
    email: "demo.head.audiovisual@alemdemo.invalid",
    fullName: "[Demo] Bruno Tavares",
    jobTitle: "Head de Audiovisual",
    accessRole: "coordinator",
    functions: ["direcao"],
    squads: ["audiovisual"],
    orgLevel: "head",
  });
  const headComercial = await ensureDemoUser({
    email: "demo.head.comercial@alemdemo.invalid",
    fullName: "[Demo] Carla Nogueira",
    jobTitle: "Head Comercial",
    accessRole: "coordinator",
    functions: [],
    squads: ["comercial"],
    leadSquads: ["comercial"],
    orgLevel: "head",
  });
  const headFinanceiro = await ensureDemoUser({
    email: "demo.head.financeiro@alemdemo.invalid",
    fullName: "[Demo] Diego Farias",
    jobTitle: "Head Financeiro",
    accessRole: "coordinator",
    functions: [],
    squads: ["financeiro"],
    orgLevel: "head",
  });
  const filmmaker = await ensureDemoUser({
    email: "demo.filmmaker@alemdemo.invalid",
    fullName: "[Demo] Felipe Aragão",
    jobTitle: "Filmmaker",
    accessRole: "member",
    functions: ["captacao", "direcao"],
    squads: ["audiovisual"],
    orgLevel: "executor",
  });
  const editor = await ensureDemoUser({
    email: "demo.editor@alemdemo.invalid",
    fullName: "[Demo] Giulia Ramos",
    jobTitle: "Editor",
    accessRole: "member",
    functions: ["edicao"],
    squads: ["audiovisual"],
    orgLevel: "executor",
  });
  const designer = await ensureDemoUser({
    email: "demo.designer@alemdemo.invalid",
    fullName: "[Demo] Heitor Sales",
    jobTitle: "Designer",
    accessRole: "member",
    functions: ["motion"],
    squads: ["audiovisual"],
    orgLevel: "executor",
  });
  const sdr = await ensureDemoUser({
    email: "demo.sdr@alemdemo.invalid",
    fullName: "[Demo] Isabela Prado",
    jobTitle: "SDR",
    accessRole: "sdr",
    functions: [],
    squads: ["comercial"],
    orgLevel: "executor",
  });
  const atendimento = await ensureDemoUser({
    email: "demo.atendimento@alemdemo.invalid",
    fullName: "[Demo] Larissa Mendes",
    jobTitle: "Atendimento",
    accessRole: "member",
    functions: [],
    squads: ["comercial"],
    orgLevel: "executor",
  });
  const bdr = await ensureDemoUser({
    email: "demo.bdr@alemdemo.invalid",
    fullName: "[Demo] Thiago Cavalcante",
    jobTitle: "BDR",
    accessRole: "bdr",
    functions: [],
    squads: ["comercial"],
    orgLevel: "executor",
  });

  // Pessoa em três squads — para o quadro pessoal agrupado por squad e os contadores por squad.
  const multiSquad = await ensureDemoUser({
    email: "demo.operacoes@alemdemo.invalid",
    fullName: "[Demo] Paula Siqueira",
    jobTitle: "Coordenadora de operações",
    accessRole: "member",
    functions: ["producao"],
    squads: ["comercial", "financeiro", "audiovisual"],
    orgLevel: "executor",
  });

  console.log(`Contas de demonstração prontas (senha: ${DEMO_LOGIN_PASSWORD}):`);
  console.log("  master/CEO ......... demo.ceo@alemdemo.invalid");
  console.log("  head audiovisual .... demo.head.audiovisual@alemdemo.invalid");
  console.log("  head comercial ...... demo.head.comercial@alemdemo.invalid");
  console.log("  head financeiro ..... demo.head.financeiro@alemdemo.invalid");
  console.log("  executor filmmaker .. demo.filmmaker@alemdemo.invalid");
  console.log("  executor editor ..... demo.editor@alemdemo.invalid");
  console.log("  executor designer ... demo.designer@alemdemo.invalid");
  console.log("  executor sdr ........ demo.sdr@alemdemo.invalid");
  console.log("  executor bdr ........ demo.bdr@alemdemo.invalid");
  console.log("  atendimento ......... demo.atendimento@alemdemo.invalid");
  console.log("  3 squads (operações)  demo.operacoes@alemdemo.invalid");

  return { ceo, headAudiovisual, headComercial, headFinanceiro, filmmaker, editor, designer, sdr, bdr, atendimento, multiSquad };
}

async function seed() {
  await clean();
  const demoUsers = await seedHierarchyDemoUsers();
  const owner = await pickOwner();
  const team = await pickTeam(owner);
  const person = (offset: number) => team[offset % team.length] ?? owner;

  const aurora = await insertCompany({
    name: `${PREFIX} Casa Aurora`,
    lifecycle: "client",
    source: "indicacao",
    source_detail: "Indicada por um cliente antigo",
    city: "Natal",
    health: "ativo",
    tier: "high_ticket",
  });
  const mare = await insertCompany({
    name: `${PREFIX} Studio Maré`,
    lifecycle: "client",
    source: "instagram",
    city: "Natal",
    health: "atencao",
    health_note: "Atraso recorrente no pagamento das parcelas.",
    tier: "mid_ticket",
  });
  const bussola = await insertCompany({
    name: `${PREFIX} Agência Bússola`,
    lifecycle: "client",
    source: "evento",
    city: "Mossoró",
    health: "tensao",
    health_note: "Pediu revisão de escopo duas vezes neste mês.",
    tier: "low_ticket",
  });
  const vento = await insertCompany({
    name: `${PREFIX} Grupo Vento`,
    lifecycle: "client",
    source: "site",
    city: "Fortaleza",
    health: "churn",
    health_note: "Não renovou após o último projeto entregue.",
    tier: "mid_ticket",
  });
  await insertCompany({ name: `${PREFIX} Nova Onda`, lifecycle: "prospect", source: "crm" });

  fail(
    "contacts",
    (
      await supabase.from("contacts").insert([
        { company_id: aurora, full_name: "Helena Duarte", job_title: "Marketing", email: "helena@demo.invalid" },
        { company_id: mare, full_name: "Rafael Nunes", job_title: "Sócio", email: "rafael@demo.invalid" },
        { company_id: bussola, full_name: "Camila Rocha", job_title: "Marketing", email: "camila@demo.invalid" },
      ])
    ).error,
  );

  // Transacional: entrega única, com due_date.
  const verao = await insertProject({
    name: `${PREFIX} Campanha Verão`,
    company_id: aurora,
    owner_id: owner,
    model: "transacional",
    stage: "producao",
    due_date: isoDay(20),
    priority: "alta",
    service_types: ["captacao", "edicao"],
    briefing: "Série de vídeos para redes sociais no verão.",
    drive_folder_url: "https://drive.google.com/drive/folders/demo-verao",
    included_revision_rounds: 2,
  });

  // Recorrente: contrato em andamento, sem end_date ("Em andamento desde…").
  const institucional = await insertProject({
    name: `${PREFIX} Conteúdo Mensal Maré`,
    company_id: mare,
    owner_id: owner,
    model: "recorrente",
    stage: "captacao",
    start_date: isoDay(-90),
    priority: "media",
    service_types: ["producao_completa"],
    included_revision_rounds: 1,
  });

  // Transacional com custos altos — demonstra margem crítica.
  const ensaio = await insertProject({
    name: `${PREFIX} Ensaio Bússola`,
    company_id: bussola,
    owner_id: owner,
    model: "transacional",
    stage: "revisao_interna",
    due_date: isoDay(10),
    priority: "media",
    service_types: ["captacao"],
  });

  const reels = await insertProject({
    name: `${PREFIX} Reels Além Filmes`,
    is_internal: true,
    owner_id: owner,
    model: "transacional",
    stage: "planejamento",
    due_date: isoDay(30),
    priority: "baixa",
  });

  fail(
    "project_members",
    (
      await supabase.from("project_members").insert([
        { project_id: verao, profile_id: owner },
        { project_id: institucional, profile_id: owner },
        { project_id: ensaio, profile_id: owner },
        { project_id: reels, profile_id: owner },
      ])
    ).error,
  );

  fail(
    "project_financials",
    (
      await supabase.from("project_financials").insert([
        // Custos totais 4200+1800+8500=14500 → margem 39,6% (crítico).
        { project_id: verao, contract_value: 24000, payment_terms: "3 parcelas de 30 dias, via Pix." },
        { project_id: institucional, contract_value: 1200, payment_terms: "Mensalidade fixa, todo dia 5." },
        // Custos 5250 → margem 47,5% (atenção).
        { project_id: ensaio, contract_value: 10000, payment_terms: "50% na assinatura, 50% na entrega." },
      ])
    ).error,
  );

  const [p1 = 0, p2 = 0, p3 = 0] = splitInstallments(2_400_000, 3);

  fail(
    "receivables",
    (
      await supabase.from("receivables").insert([
        receivable(aurora, verao, "Campanha Verão — parcela 1/3", p1, -30, { installment_number: 1, installment_total: 3, ...received(p1, -28, "pix", "1001") }),
        receivable(aurora, verao, "Campanha Verão — parcela 2/3", p2, -5, { installment_number: 2, installment_total: 3, payment_method: "pix" }),
        receivable(aurora, verao, "Campanha Verão — parcela 3/3", p3, 25, { installment_number: 3, installment_total: 3, payment_method: "pix" }),
        receivable(mare, institucional, "Mensalidade — mês corrente", 120000, -3, { ...received(120000, -3, "boleto", "2001") }),
        receivable(mare, institucional, "Mensalidade — próximo mês", 120000, 27, { payment_method: "boleto" }),
        receivable(bussola, ensaio, "Ensaio Bússola — entrada", 500000, -10, { ...received(500000, -10, "pix", "3001") }),
        receivable(bussola, ensaio, "Ensaio Bússola — saldo", 500000, 5, { payment_method: "pix" }),
        receivable(aurora, null, "Diária de captação avulsa", 350000, 7, { payment_method: "pix" }),
      ])
    ).error,
  );

  fail(
    "payables",
    (
      await supabase.from("payables").insert([
        {
          project_id: verao,
          payee_name: `${PREFIX} Marina Editora`,
          category: "freelancer",
          description: `${PREFIX} Edição — Campanha Verão`,
          amount: 4200,
          due_date: isoDay(-10),
          paid_at: isoDay(-9),
          payment_method: "pix",
        },
        {
          project_id: verao,
          payee_name: `${PREFIX} Locadora Foco`,
          category: "locacao",
          description: `${PREFIX} Locação de lentes`,
          amount: 1800,
          due_date: isoDay(6),
        },
        {
          project_id: verao,
          payee_name: `${PREFIX} Equipamentos Norte`,
          category: "equipamento",
          description: `${PREFIX} Aluguel de drone e estabilizador`,
          amount: 8500,
          due_date: isoDay(8),
        },
        {
          project_id: institucional,
          payee_name: `${PREFIX} Posto Central`,
          category: "deslocamento",
          description: `${PREFIX} Deslocamento para captação`,
          amount: 650,
          due_date: isoDay(-3),
        },
        {
          project_id: institucional,
          payee_name: `${PREFIX} Banco de trilhas`,
          category: "trilha_licenca",
          description: `${PREFIX} Licença de trilha`,
          amount: 480,
          due_date: isoDay(12),
        },
        {
          project_id: ensaio,
          payee_name: `${PREFIX} Camila Freela`,
          category: "freelancer",
          description: `${PREFIX} Assistência de produção`,
          amount: 3200,
          due_date: isoDay(-2),
          paid_at: isoDay(-2),
          payment_method: "transferencia",
        },
        {
          project_id: ensaio,
          payee_name: `${PREFIX} Estúdio Alfa`,
          category: "locacao",
          description: `${PREFIX} Diária de estúdio`,
          amount: 2050,
          due_date: isoDay(4),
        },
        {
          project_id: reels,
          payee_name: `${PREFIX} Cabine Studio`,
          category: "locacao",
          description: `${PREFIX} Diária de estúdio — Reels`,
          amount: 900,
          due_date: isoDay(18),
        },
        {
          project_id: null,
          payee_name: `${PREFIX} Adobe`,
          category: "software",
          description: `${PREFIX} Assinatura de software`,
          amount: 259.9,
          due_date: isoDay(9),
        },
        {
          project_id: null,
          payee_name: `${PREFIX} Gráfica Norte`,
          category: "marketing",
          description: `${PREFIX} Cartões e material impresso`,
          amount: 720,
          due_date: isoDay(-14),
          paid_at: isoDay(-14),
          payment_method: "cartao",
        },
      ])
    ).error,
  );

  // ---------------------------------------------------------------------------
  // 12 meses de histórico financeiro (para os gráficos do dashboard): mensalidade
  // recorrente da Maré, custos fixos e variáveis todo mês, um mês com resultado
  // negativo (custo grande sem receita correspondente) e uma recorrência real
  // (gerada aqui manualmente, como generate_recurring_payables faria).
  // ---------------------------------------------------------------------------

  const monthlyReceivables: Tables["receivables"]["Insert"][] = [];
  const monthlyPayables: Tables["payables"]["Insert"][] = [];

  for (let m = -11; m <= 0; m++) {
    const dueDate = monthDay(m, 5);
    const competence = monthDay(m, 1);
    const isPast = m < 0;
    monthlyReceivables.push({
      company_id: mare,
      project_id: institucional,
      description: `${PREFIX} Mensalidade Maré — ${competence.slice(0, 7)}`,
      service_description: "Conteúdo mensal recorrente (Instagram + Reels)",
      competence_month: competence,
      amount: centsToNumber(120000),
      due_date: dueDate,
      // As duas últimas competências passadas ficam em aberto (uma delas atrasada) para os contadores do dashboard.
      ...(isPast && m < -1
        ? {
            received_at: dueDate,
            received_amount: centsToNumber(120000),
            payment_method: "boleto" as const,
            invoice_number: `M${1000 - m}`,
          }
        : { payment_method: "boleto" as const }),
    });

    // Custo fixo: aluguel do estúdio — pago nos meses passados, em aberto no mês corrente.
    monthlyPayables.push({
      payee_name: `${PREFIX} Imobiliária Cais`,
      category: "outro",
      description: `${PREFIX} Aluguel do estúdio — ${competence.slice(0, 7)}`,
      amount: 1800,
      due_date: monthDay(m, 5),
      is_fixed: true,
      ...(isPast ? { paid_at: monthDay(m, 6), payment_method: "transferencia" as const } : {}),
    });

    // Custo variável: cada mês num projeto diferente, para variar a categoria no gráfico.
    const variableProject = m % 3 === 0 ? verao : m % 3 === 1 ? institucional : ensaio;
    const variableCategory = m % 3 === 0 ? "equipamento" : m % 3 === 1 ? "deslocamento" : "freelancer";
    monthlyPayables.push({
      project_id: variableProject,
      payee_name: `${PREFIX} Fornecedor variável`,
      category: variableCategory,
      description: `${PREFIX} Custo variável — ${competence.slice(0, 7)}`,
      amount: 900 + Math.abs(m) * 35,
      due_date: monthDay(m, 18),
      is_fixed: false,
      ...(isPast ? { paid_at: monthDay(m, 19), payment_method: "pix" as const } : {}),
    });
  }

  // Mês com resultado líquido negativo: um custo grande e pontual, 6 meses atrás, sem receita à altura.
  monthlyPayables.push({
    project_id: ensaio,
    payee_name: `${PREFIX} Estúdio Alfa`,
    category: "equipamento",
    description: `${PREFIX} Pacote de equipamentos para temporada`,
    amount: 9000,
    due_date: monthDay(-6, 22),
    paid_at: monthDay(-6, 23),
    payment_method: "transferencia",
    is_fixed: false,
  });

  fail("receivables (mensal)", (await supabase.from("receivables").insert(monthlyReceivables)).error);
  fail("payables (mensal)", (await supabase.from("payables").insert(monthlyPayables)).error);

  // Recorrência de verdade: assinatura de software mensal, com algumas ocorrências futuras já
  // materializadas (é isto que generate_recurring_payables faz ao salvar um custo recorrente).
  const { data: recurringParent, error: recurringParentError } = await supabase
    .from("payables")
    .insert({
      payee_name: `${PREFIX} Adobe Creative Cloud`,
      category: "software",
      description: `${PREFIX} Assinatura de software recorrente`,
      amount: 299,
      due_date: monthDay(-1, 12),
      is_fixed: true,
      recurrence: "mensal",
      recurrence_until: monthDay(6, 12),
      paid_at: monthDay(-1, 12),
      payment_method: "cartao",
    })
    .select("id")
    .single();
  fail("payables (recorrência)", recurringParentError);

  if (recurringParent) {
    const children: Tables["payables"]["Insert"][] = [];
    for (let m = 0; m <= 6; m++) {
      children.push({
        payee_name: `${PREFIX} Adobe Creative Cloud`,
        category: "software",
        description: `${PREFIX} Assinatura de software recorrente`,
        amount: 299,
        due_date: monthDay(m, 12),
        is_fixed: true,
        recurrence: "none",
        recurrence_parent_id: recurringParent.id,
        ...(m === 0 ? { paid_at: monthDay(m, 12), payment_method: "cartao" as const } : {}),
      });
    }
    fail("payables (ocorrências futuras)", (await supabase.from("payables").insert(children)).error);
  }

  // 12 pautas espalhadas pelas 4 colunas, pelos 7 status, com líderes/responsáveis variados,
  // prioridades diferentes e duas em atraso (não entregues, prazo no passado) para os contadores.
  // board_column fica de fora de propósito: é NOT NULL sem default no SQL, mas o trigger
  // before-insert a calcula a partir do "status" — por isso a lista aqui não a informa. Mesmo caso
  // de "squad": NOT NULL preenchido pelo trigger pautas_set_squad (pauta de produção = audiovisual).
  const pautas: Omit<Tables["pautas"]["Insert"], "board_column" | "squad">[] = [
    {
      project_id: verao,
      title: `${PREFIX} Roteiro da campanha`,
      status: "planejamento",
      priority: "alta",
      lead_id: person(0),
      current_assignee_id: person(0),
      due_date: isoDay(25),
      format: "Vertical",
    },
    {
      project_id: verao,
      title: `${PREFIX} Captação — praia do Forte`,
      status: "captacao",
      priority: "media",
      lead_id: person(0),
      current_assignee_id: person(1),
      capture_type: ["foto", "video"],
      format: "Vertical",
      location_address: "Praia do Forte, Natal - RN",
      scheduled_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      duration_minutes: 180,
      due_date: isoDay(18),
    },
    {
      project_id: verao,
      title: `${PREFIX} Edição — teaser 15s`,
      status: "edicao",
      priority: "alta",
      is_critical: true,
      lead_id: person(0),
      current_assignee_id: person(2),
      due_date: isoDay(5),
    },
    {
      project_id: verao,
      title: `${PREFIX} Aprovação — vídeo principal`,
      status: "revisao_cliente",
      priority: "urgente",
      lead_id: person(0),
      current_assignee_id: person(3),
      due_date: isoDay(1),
    },
    {
      project_id: verao,
      title: `${PREFIX} Stories de bastidores`,
      status: "aprovado",
      priority: "baixa",
      lead_id: person(1),
      current_assignee_id: person(1),
      due_date: isoDay(-10),
    },
    {
      project_id: institucional,
      title: `${PREFIX} Pauta do mês — institucional`,
      status: "planejamento",
      priority: "media",
      lead_id: person(1),
      current_assignee_id: person(1),
      due_date: isoDay(15),
    },
    {
      project_id: institucional,
      title: `${PREFIX} Captação — linha de produção`,
      status: "captacao",
      priority: "media",
      lead_id: person(1),
      current_assignee_id: person(2),
      capture_type: ["video"],
      format: "Horizontal",
      location_address: "Sede da Studio Maré, Natal - RN",
      scheduled_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      duration_minutes: 240,
      due_date: isoDay(22),
    },
    {
      project_id: institucional,
      title: `${PREFIX} Revisão interna — vídeo institucional`,
      status: "revisao_interna",
      priority: "alta",
      lead_id: person(1),
      current_assignee_id: person(0),
      due_date: isoDay(-2),
    },
    {
      project_id: institucional,
      title: `${PREFIX} Reajuste — cortes pedidos pelo cliente`,
      status: "reajuste",
      priority: "alta",
      is_critical: true,
      lead_id: person(1),
      current_assignee_id: person(2),
      due_date: isoDay(3),
    },
    {
      project_id: ensaio,
      title: `${PREFIX} Planejamento do ensaio`,
      status: "planejamento",
      priority: "media",
      lead_id: person(2),
      current_assignee_id: person(2),
      due_date: isoDay(8),
    },
    {
      project_id: ensaio,
      title: `${PREFIX} Edição das fotos do ensaio`,
      status: "edicao",
      priority: "media",
      lead_id: person(2),
      current_assignee_id: person(3),
      capture_type: ["foto"],
      format: "Quadrado",
      due_date: isoDay(-1),
    },
    {
      project_id: reels,
      title: `${PREFIX} Reel institucional Além Filmes`,
      status: "aprovado",
      priority: "baixa",
      lead_id: owner,
      current_assignee_id: owner,
      due_date: isoDay(-5),
    },
  ];

  for (const pauta of pautas) {
    await insertPauta(pauta as Tables["pautas"]["Insert"]);
  }

  // Pautas que atravessam a hierarquia — para avaliar /pautas e /minhas-pautas com logins
  // diferentes: o head de audiovisual lidera e passa para o filmmaker (ACOMPANHANDO para o
  // head); o filmmaker lidera e passa para o editor; e uma volta do editor para o designer como
  // reajuste (DEVOLVIDAS para o editor, notificação com nota para o designer).
  await insertPauta({
    project_id: verao,
    title: `${PREFIX} Captação — making of da campanha`,
    status: "captacao",
    priority: "alta",
    lead_id: demoUsers.headAudiovisual,
    current_assignee_id: demoUsers.filmmaker,
    capture_type: ["video"],
    format: "Vertical",
    scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    due_date: isoDay(12),
  } as Tables["pautas"]["Insert"]);

  await insertPauta({
    project_id: institucional,
    title: `${PREFIX} Motion da vinheta institucional`,
    status: "edicao",
    priority: "media",
    lead_id: demoUsers.filmmaker,
    current_assignee_id: demoUsers.editor,
    due_date: isoDay(6),
  } as Tables["pautas"]["Insert"]);

  const reajusteId = await insertPauta({
    project_id: ensaio,
    title: `${PREFIX} Motion do teaser do ensaio`,
    status: "edicao",
    priority: "alta",
    lead_id: demoUsers.headAudiovisual,
    current_assignee_id: demoUsers.editor,
    due_date: isoDay(4),
  } as Tables["pautas"]["Insert"]);
  // Segunda etapa: o editor devolve para o designer ajustar a motion — dispara
  // pautas_track_handover (DEVOLVIDAS no quadro do editor) e pautas_notify_reajuste (nota).
  fail(
    "pautas (reajuste demo)",
    (
      await supabase
        .from("pautas")
        .update({ status: "reajuste", current_assignee_id: demoUsers.designer })
        .eq("id", reajusteId)
    ).error,
  );

  // Tarefa avulsa: pessoal, sem cliente nem projeto — só aparece no quadro de quem a criou.
  fail(
    "pautas (tarefa avulsa demo)",
    (
      await supabase.from("pautas").insert({
        title: `${PREFIX} Preparar lista de leads da semana`,
        briefing: "Levantar 20 contatos novos para prospecção ativa.",
        is_standalone: true,
        created_for: demoUsers.sdr,
        lead_id: demoUsers.sdr,
        current_assignee_id: demoUsers.sdr,
        priority: "media",
        due_date: isoDay(2),
      } as Tables["pautas"]["Insert"])
    ).error,
  );

  await seedTimeEntries(demoUsers.filmmaker, demoUsers.editor);
  await seedCrmDemo(demoUsers);
  await seedCompanyLogos([
    { id: aurora, shape: "sol" },
    { id: mare, shape: "ondas" },
    { id: bussola, shape: "bussola" },
    { id: vento, shape: "barras" },
  ]);
  await seedMultiSquadPautas(demoUsers, verao);
  await seedAgendaDemo(demoUsers, { aurora, mare, bussola, verao, institucional });

  console.log("Dados de demonstração criados: 5 empresas (4 clientes com saúdes/níveis distintos, 1 prospect),");
  console.log("4 projetos (transacional, recorrente, interno; um com margem crítica e outro em atenção),");
  console.log("15 pautas nas 4 colunas do quadro (12 originais + 3 atravessando a hierarquia),");
  console.log("uma tarefa avulsa (SDR) e 9 contas de demonstração cobrindo master/head/executor,");
  console.log("12 meses de histórico financeiro (recebido, pendente, atrasado, custos fixos e variáveis,");
  console.log("um mês com resultado negativo) e uma assinatura recorrente com ocorrências futuras,");
  console.log("~20 dias úteis de banco de horas para uma ou duas pessoas (dias normais, um curto,");
  console.log("um com hora extra e uma sessão em aberto hoje), e 16 negócios do CRM em todas as 10 etapas do funil:");
  console.log("uma com várias tentativas de contato, uma que voltou de reunião para o SDR, uma com proposta em negociação,");
  console.log("uma ganha com handoff para o atendimento (cliente + projeto + pauta de onboarding), uma perdida há 46 dias pronta");
  console.log("para reaquecer e uma já reaquecida em venda direta.");
  console.log("Logos (PNG gerado) em 4 clientes — o prospect fica sem logo para mostrar o monograma —, 8 pautas de uma pessoa");
  console.log("em 3 squads (com e sem horário) e ~14 compromissos nas próximas 2 semanas: reuniões, captações (uma vinculada");
  console.log("a pauta), entregas de dia inteiro, uma reunião semanal e uma diária recorrentes e um compromisso privado.");
}

// ---------------------------------------------------------------------------
// CRM: negócios em todas as etapas do funil, com o fluxo real — responsável que muda por regra, contatos
// registrados, reuniões (com resultado e roteamento), propostas, negociação, ganho com handoff para o
// atendimento, lead perdido há 46 dias pronto para reaquecer e um lead já reaquecido em venda direta.
// A service role não tem auth.uid(): as travas de interação/etapa liberam (mesmo padrão de
// profiles_guard_update), mas o roteamento de responsável, as pautas, os compromissos e as
// notificações rodam de verdade. Quatro negócios ficam propositalmente fora de dia (temperatura).
// ---------------------------------------------------------------------------

type DealStage = Database["public"]["Enums"]["deal_stage"];
type InteractionChannel = Database["public"]["Enums"]["deal_interaction_channel"];
type InteractionKind = Database["public"]["Enums"]["deal_interaction_kind"];
type ProspectionGoal = Database["public"]["Enums"]["prospection_goal"];
type CompanySource = Database["public"]["Enums"]["company_source"];
type MeetingResult = Database["public"]["Enums"]["meeting_outcome"];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();
const aheadIso = (ms: number) => new Date(Date.now() + ms).toISOString();

async function insertProspect(name: string, source: CompanySource, contactName: string) {
  const id = await insertCompany({ name: `${PREFIX} ${name}`, lifecycle: "prospect", source, city: "Natal", segment: "Serviços" });
  fail(
    "contacts (CRM)",
    (
      await supabase
        .from("contacts")
        .insert({ company_id: id, full_name: contactName, job_title: "Marketing", phone: "84 99999-0000", email: `${contactName.split(" ")[0]?.toLowerCase()}@demo.invalid`, is_primary: true })
    ).error,
  );
  return id;
}

interface NewDealInput {
  companyId: string;
  title: string;
  ownerId: string;
  stage?: DealStage;
  goals: ProspectionGoal[];
  source: CompanySource;
  value?: number;
  nextAction: string;
  nextActionAt: string;
  createdAgo?: number;
  lostAt?: string;
  lostReason?: Database["public"]["Enums"]["deal_loss_reason"];
}

async function newDeal(input: NewDealInput) {
  const { data, error } = await supabase
    .from("deals")
    .insert({
      company_id: input.companyId,
      title: `${PREFIX} ${input.title}`,
      owner_id: input.ownerId,
      stage: input.stage ?? "prospeccao",
      prospection_goals: input.goals,
      source: input.source,
      estimated_value: input.value ?? null,
      next_action: input.nextAction,
      next_action_at: input.nextActionAt,
      created_at: input.createdAgo !== undefined ? agoIso(input.createdAgo) : undefined,
      lost_at: input.lostAt,
      lost_reason: input.lostReason,
    })
    .select("id")
    .single();
  if (error) throw new Error(`deals: ${error.message}`);
  return data.id;
}

async function interact(
  dealId: string,
  kind: InteractionKind,
  channel: InteractionChannel | null,
  approach: string | null,
  body: string,
  authorId: string,
  agoMs: number,
  stage: DealStage,
  respondedTo?: string,
) {
  const { data, error } = await supabase
    .from("deal_interactions")
    .insert({
      deal_id: dealId,
      kind,
      channel,
      approach,
      body: `${PREFIX} ${body}`,
      author_id: authorId,
      occurred_at: agoIso(agoMs),
      stage,
      responded_to_interaction_id: respondedTo,
    })
    .select("id")
    .single();
  if (error) throw new Error(`deal_interactions: ${error.message}`);
  return data.id;
}

async function qualify(dealId: string, by: string) {
  fail(
    "deal_qualification",
    (
      await supabase.from("deal_qualification").insert({
        deal_id: dealId,
        budget_range: "R$ 15 mil a R$ 30 mil",
        project_type: "Campanha institucional",
        desired_timeline: "Em até 60 dias",
        decision_maker_contacted: true,
        pain_point: "Precisa renovar a presença digital antes do próximo lançamento.",
        qualified_by: by,
      })
    ).error,
  );
}

async function scheduleMeeting(dealId: string, attendee: string, offsetMs: number, createdBy: string) {
  const { data, error } = await supabase
    .from("deal_meetings")
    .insert({
      deal_id: dealId,
      scheduled_at: new Date(Date.now() + offsetMs).toISOString(),
      duration_minutes: 45,
      attendee_id: attendee,
      location_or_link: "https://meet.google.com/demo-reuniao",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(`deal_meetings: ${error.message}`);
  return data.id;
}

async function meetingOutcome(meetingId: string, result: MeetingResult, note: string) {
  fail(
    `outcome (${result})`,
    (await supabase.rpc("deal_register_meeting_outcome", { p_meeting_id: meetingId, p_result: result, p_note: `${PREFIX} ${note}` })).error,
  );
}

async function registerProposal(dealId: string, amount: number, channel: Database["public"]["Enums"]["proposal_channel"]) {
  const { data, error } = await supabase.rpc("deal_register_proposal", {
    p_deal_id: dealId,
    p_amount: amount,
    p_channel: channel,
    p_document_url: "https://drive.google.com/demo-proposta.pdf",
    p_scope_notes: "Roteiro, captação em 2 diárias e edição final.",
    p_next_action: "Follow-up da proposta",
    p_next_action_at: aheadIso(DAY),
  });
  if (error) throw new Error(`proposal: ${error.message}`);
  return data;
}

/** Caminho completo até "proposta enviada": qualificação → reunião passada com o CEO → proposta. */
async function dealUntilProposal(input: NewDealInput & { meetingAgo: number; amount: number; sdr: string; ceo: string }) {
  const dealId = await newDeal(input);
  await interact(dealId, "tentativa_contato", "whatsapp", "Case de cliente parecido", "Primeiro contato pelo WhatsApp.", input.sdr, input.meetingAgo + 6 * DAY, "prospeccao");
  await qualify(dealId, input.sdr);
  const meetingId = await scheduleMeeting(dealId, input.ceo, -input.meetingAgo, input.sdr);
  await meetingOutcome(meetingId, "enviar_proposta", "Reunião boa: quer proposta com dois pacotes.");
  const proposalId = await registerProposal(dealId, input.amount, "whatsapp_pdf");
  return { dealId, proposalId };
}

async function seedCrmDemo(users: Awaited<ReturnType<typeof seedHierarchyDemoUsers>>) {
  const { sdr, bdr, ceo, atendimento } = users;
  const created: string[] = [];
  const track = (id: string) => {
    created.push(id);
    return id;
  };

  // 1) Prospecção: a ação vence hoje (temperatura: atenção).
  track(
    await newDeal({
      companyId: await insertProspect("Deriva Filmes", "crm", "Marcos Vieira"),
      title: "Vídeo institucional",
      ownerId: sdr,
      goals: ["video_institucional"],
      source: "crm",
      nextAction: "Enviar mensagem de apresentação",
      nextActionAt: aheadIso(3 * HOUR),
      createdAgo: 20 * HOUR,
    }),
  );

  // 2) Prospecção parada: sem contato há 4 dias e ação vencida (temperatura: crítico).
  track(
    await newDeal({
      companyId: await insertProspect("Ateliê Coral", "instagram", "Paula Coral"),
      title: "Ensaio de coleção",
      ownerId: bdr,
      goals: ["producao_conteudo", "ativacao_marca"],
      source: "instagram",
      nextAction: "Primeira abordagem pelo Instagram",
      nextActionAt: agoIso(DAY),
      createdAgo: 4 * DAY,
    }),
  );

  // 3) Primeiro contato.
  const primeiro = track(
    await newDeal({
      companyId: await insertProspect("Grão Filmes", "site", "Rui Grão"),
      title: "Série para YouTube",
      ownerId: sdr,
      stage: "primeiro_contato",
      goals: ["producao_conteudo"],
      source: "site",
      nextAction: "Ligar para entender a demanda",
      nextActionAt: aheadIso(DAY),
      createdAgo: 2 * DAY,
    }),
  );
  await interact(primeiro, "tentativa_contato", "whatsapp", "Apresentação da Além", "Mandei o portfólio e perguntei sobre o momento do canal.", sdr, 20 * HOUR, "primeiro_contato");

  // 4) Tentativas de contato: várias tentativas por canais diferentes (30h sem atualização: atenção).
  const tentativas = track(
    await newDeal({
      companyId: await insertProspect("Vértice Consultoria", "evento", "Cláudia Vértice"),
      title: "Vídeos de treinamento interno",
      ownerId: sdr,
      stage: "tentativas_contato",
      goals: ["recorrencia", "producao_conteudo"],
      source: "evento",
      nextAction: "Tentar de novo por ligação à tarde",
      nextActionAt: aheadIso(6 * HOUR),
      createdAgo: 6 * DAY,
    }),
  );
  await interact(tentativas, "tentativa_contato", "whatsapp", "Conversa do evento", "Lembrei do papo no evento e ofereci uma call.", sdr, 5 * DAY, "primeiro_contato");
  await interact(tentativas, "tentativa_contato", "ligacao", "Horário comercial", "Caiu na caixa postal.", sdr, 4 * DAY, "tentativas_contato");
  await interact(tentativas, "tentativa_contato", "email", "Case de treinamento", "E-mail com um case parecido em anexo.", sdr, 3 * DAY, "tentativas_contato");
  await interact(tentativas, "tentativa_contato", "linkedin", "Conexão + mensagem", "Enviei convite e mensagem curta.", sdr, 2 * DAY, "tentativas_contato");
  await interact(tentativas, "tentativa_contato", "whatsapp", "Segundo toque", "Perguntei se faz sentido conversar esta semana.", sdr, 30 * HOUR, "tentativas_contato");

  // 5) Tentativas: o cliente respondeu à segunda tentativa (a UI sugere avançar).
  const respondeu = track(
    await newDeal({
      companyId: await insertProspect("Sal Marketing", "prospeccao_ativa", "Sérgio Sal"),
      title: "Rebranding em vídeo",
      ownerId: bdr,
      stage: "tentativas_contato",
      goals: ["video_institucional", "ativacao_marca"],
      source: "prospeccao_ativa",
      nextAction: "Agendar a conversa de qualificação",
      nextActionAt: aheadIso(DAY),
      createdAgo: 5 * DAY,
    }),
  );
  await interact(respondeu, "tentativa_contato", "email", "Case de rebranding", "Primeiro e-mail.", bdr, 4 * DAY, "primeiro_contato");
  const segunda = await interact(respondeu, "tentativa_contato", "whatsapp", "Pergunta direta", "Perguntei se estavam pensando em rebranding.", bdr, 2 * DAY, "tentativas_contato");
  await interact(respondeu, "resposta_cliente", "whatsapp", null, "Disse que sim e pediu para falar depois das 14h.", bdr, 3 * HOUR, "tentativas_contato", segunda);

  // 6) Qualificado: a bola vai para o Head Comercial (pauta e notificação criadas pelo banco).
  const qualificado = track(
    await newDeal({
      companyId: await insertProspect("Litoral Kids", "indicacao", "Renata Litoral"),
      title: "Campanha de volta às aulas",
      ownerId: sdr,
      goals: ["campanha_institucional"],
      source: "indicacao",
      value: 18000,
      nextAction: "Passar o lead qualificado ao head",
      nextActionAt: aheadIso(DAY),
      createdAgo: 8 * DAY,
    }),
  );
  await interact(qualificado, "tentativa_contato", "whatsapp", "Indicação de cliente", "Abordei citando quem indicou.", sdr, 7 * DAY, "prospeccao");
  await interact(qualificado, "resposta_cliente", "ligacao", null, "Conversamos 20 min: orçamento, prazo e decisor confirmados.", sdr, 6 * HOUR, "prospeccao");
  await qualify(qualificado, sdr);
  fail("qualificado (6)", (await supabase.from("deals").update({ stage: "qualificado" }).eq("id", qualificado)).error);

  // 7) Qualificado com direcionamento do head: a bola volta ao SDR com a tarefa.
  const direcionado = track(
    await newDeal({
      companyId: await insertProspect("Metrópole Ads", "cliente_antigo", "Bruno Metrópole"),
      title: "Conteúdo para tráfego pago",
      ownerId: bdr,
      goals: ["producao_conteudo", "recorrencia"],
      source: "cliente_antigo",
      value: 9500,
      nextAction: "Passar o lead qualificado ao head",
      nextActionAt: aheadIso(DAY),
      createdAgo: 9 * DAY,
    }),
  );
  await interact(direcionado, "resposta_cliente", "email", null, "Respondeu e-mail confirmando interesse em recorrência.", bdr, 3 * DAY, "prospeccao");
  await qualify(direcionado, bdr);
  fail("qualificado (7)", (await supabase.from("deals").update({ stage: "qualificado" }).eq("id", direcionado)).error);
  fail(
    "direcionamento",
    (
      await supabase.rpc("deal_set_direction", {
        p_deal_id: direcionado,
        p_task: "enviar_material",
        p_note: `${PREFIX} Mandar o portfólio de recorrência antes da reunião com o CEO.`,
        p_due: aheadIso(DAY),
      })
    ).error,
  );

  // 8) Reunião agendada com o CEO (o INSERT cria o compromisso, move a etapa e passa a bola).
  const agendada = track(
    await newDeal({
      companyId: await insertProspect("Raiz Produções", "evento", "Tânia Raiz"),
      title: "Documentário institucional",
      ownerId: sdr,
      goals: ["video_institucional"],
      source: "evento",
      value: 32000,
      nextAction: "Passar o lead qualificado ao head",
      nextActionAt: aheadIso(DAY),
      createdAgo: 12 * DAY,
    }),
  );
  await interact(agendada, "resposta_cliente", "meet", null, "Call de qualificação de 30 min com a diretora.", sdr, 2 * DAY, "prospeccao");
  await qualify(agendada, sdr);
  await scheduleMeeting(agendada, ceo, 2 * DAY, sdr);

  // 9) Voltou da reunião para o SDR (follow-up): reaparece no /minhas-pautas dele.
  const voltou = track(
    await newDeal({
      companyId: await insertProspect("Torre Forte Imóveis", "site", "Tiago Torre"),
      title: "Tour em vídeo de lançamentos",
      ownerId: sdr,
      goals: ["cobertura_evento", "video_institucional"],
      source: "site",
      value: 21000,
      nextAction: "Passar o lead qualificado ao head",
      nextActionAt: aheadIso(DAY),
      createdAgo: 14 * DAY,
    }),
  );
  await interact(voltou, "resposta_cliente", "whatsapp", null, "Confirmou orçamento e prazo.", sdr, 5 * DAY, "prospeccao");
  await qualify(voltou, sdr);
  await meetingOutcome(await scheduleMeeting(voltou, ceo, -DAY, sdr), "follow_up_sdr", "Gostou, mas precisa alinhar com o sócio. O SDR faz o follow-up em 2 dias.");

  // 10) Reunião realizada: o CEO vai enviar a proposta.
  const paraProposta = track(
    await newDeal({
      companyId: await insertProspect("Brisa Turismo", "indicacao", "Bianca Brisa"),
      title: "Campanha de temporada",
      ownerId: bdr,
      goals: ["campanha_institucional", "cobertura_evento"],
      source: "indicacao",
      value: 27000,
      nextAction: "Passar o lead qualificado ao head",
      nextActionAt: aheadIso(DAY),
      createdAgo: 15 * DAY,
    }),
  );
  await interact(paraProposta, "resposta_cliente", "ligacao", null, "Ligação de 25 min: tem verba aprovada.", bdr, 6 * DAY, "prospeccao");
  await qualify(paraProposta, bdr);
  await meetingOutcome(await scheduleMeeting(paraProposta, ceo, -DAY / 2, bdr), "enviar_proposta", "Quer ver dois pacotes de escopo. Enviar até amanhã.");

  // 11) Proposta enviada.
  track((await dealUntilProposal({
    companyId: await insertProspect("Cerrado Agro", "outro", "Caio Cerrado"),
    title: "Vídeo institucional do grupo",
    ownerId: sdr,
    goals: ["video_institucional"],
    source: "outro",
    nextAction: "x",
    nextActionAt: aheadIso(DAY),
    createdAgo: 20 * DAY,
    meetingAgo: 4 * DAY,
    amount: 40000,
    sdr,
    ceo,
  })).dealId);

  // 12) Em negociação: proposta enviada, o cliente respondeu e a negociação está registrada.
  const negociando = await dealUntilProposal({
    companyId: await insertProspect("Pontal Incorporadora", "site", "Paulo Pontal"),
    title: "Vídeo de lançamento",
    ownerId: bdr,
    goals: ["campanha_institucional", "video_institucional"],
    source: "site",
    nextAction: "x",
    nextActionAt: aheadIso(DAY),
    createdAgo: 26 * DAY,
    meetingAgo: 10 * DAY,
    amount: 30000,
    sdr: bdr,
    ceo,
  });
  track(negociando.dealId);
  await interact(negociando.dealId, "resposta_cliente", "whatsapp", null, "Achou o valor alto e pediu desconto para fechar o pacote completo.", bdr, 6 * HOUR, "proposta_enviada");
  fail(
    "negociação",
    (
      await supabase.rpc("deal_register_negotiation", {
        p_deal_id: negociando.dealId,
        p_proposal_id: negociando.proposalId,
        p_client_counter: 25000,
        p_our_counter: 28000,
        p_agreed: null as unknown as number,
        p_channel: "whatsapp",
        p_notes: `${PREFIX} Cliente pediu 25 mil; contrapropus 28 mil com uma diária a mais.`,
        p_next_action: "Aguardar resposta da contraproposta",
        p_next_action_at: aheadIso(2 * DAY),
      })
    ).error,
  );

  // 13) Ganho com handoff: cliente + projeto criados, atendimento assume, a comissão fica com o SDR.
  const ganho = await dealUntilProposal({
    companyId: await insertProspect("Órbita Educação", "indicacao", "Olívia Órbita"),
    title: "Curso em vídeo",
    ownerId: sdr,
    goals: ["producao_conteudo", "recorrencia"],
    source: "indicacao",
    nextAction: "x",
    nextActionAt: aheadIso(DAY),
    createdAgo: 35 * DAY,
    meetingAgo: 12 * DAY,
    amount: 25000,
    sdr,
    ceo,
  });
  track(ganho.dealId);
  await interact(ganho.dealId, "resposta_cliente", "email", null, "Aprovou a proposta por e-mail.", sdr, 2 * DAY, "proposta_enviada");
  fail(
    "close_deal_won",
    (
      await supabase.rpc("close_deal_won", {
        p_deal_id: ganho.dealId,
        p_project_name: `${PREFIX} Curso em vídeo — Órbita Educação`,
        p_project_model: "transacional",
        p_contract_value: 25000,
        p_tier: "mid_ticket",
        p_start_date: null as unknown as string,
        p_end_date: isoDay(45),
        p_project_owner_id: ceo,
        p_atendimento_id: atendimento,
      })
    ).error,
  );

  // 14) Perdido há 46 dias: pronto para o SDR decidir o reaquecimento (o cronômetro de 45 dias já venceu).
  track(
    await newDeal({
      companyId: await insertProspect("Vento Sul Eventos", "evento", "Vera Vento"),
      title: "Aftermovie do evento anual",
      ownerId: sdr,
      stage: "perdido",
      goals: ["cobertura_evento"],
      source: "evento",
      value: 12000,
      nextAction: "x",
      nextActionAt: agoIso(46 * DAY),
      createdAgo: 70 * DAY,
      lostAt: agoIso(46 * DAY),
      lostReason: "preco",
    }),
  );

  // 15) Perdido há 5 dias: ainda aguardando os 45 dias.
  track(
    await newDeal({
      companyId: await insertProspect("Nova Onda", "crm", "Nando Onda"),
      title: "Vídeo de lançamento de produto",
      ownerId: bdr,
      stage: "perdido",
      goals: ["video_institucional"],
      source: "crm",
      value: 8000,
      nextAction: "x",
      nextActionAt: agoIso(5 * DAY),
      createdAgo: 25 * DAY,
      lostAt: agoIso(5 * DAY),
      lostReason: "sem_resposta",
    }),
  );

  // 16) Lead reaquecido em venda direta: foi perdido há 50 dias e o SDR fechou a proposta sozinho (comissão de 5%).
  const reaquecido = track(
    await newDeal({
      companyId: await insertProspect("Faixa Azul Logística", "cliente_antigo", "Fábio Faixa"),
      title: "Pacote de conteúdo mensal",
      ownerId: sdr,
      stage: "perdido",
      goals: ["producao_conteudo"],
      source: "cliente_antigo",
      value: 5000,
      nextAction: "x",
      nextActionAt: agoIso(50 * DAY),
      createdAgo: 80 * DAY,
      lostAt: agoIso(50 * DAY),
      lostReason: "timing",
    }),
  );
  fail(
    "reaquecimento (venda direta)",
    (
      await supabase.rpc("deal_define_reheat", {
        p_deal_id: reaquecido,
        p_path: "venda_direta",
        p_body: `${PREFIX} Reabordei com o pacote pronto de conteúdo mensal.`,
        p_next_action: "Follow-up da proposta",
        p_next_action_at: aheadIso(DAY),
        p_proposal_amount: 4200,
        p_proposal_channel: "whatsapp_pdf",
      })
    ).error,
  );

  // As funções do banco gravam autor nulo sem sessão: atribui ao SDR dono do negócio.
  const { data: demoDeals } = await supabase.from("deals").select("id, owner_id").like("title", `${PREFIX}%`);
  for (const deal of demoDeals ?? []) {
    fail("autores das interações", (await supabase.from("deal_interactions").update({ author_id: deal.owner_id }).eq("deal_id", deal.id).is("author_id", null)).error);
  }
  void created;
}

// ---------------------------------------------------------------------------
// Banco de horas: ~20 dias úteis (indo para trás a partir de ontem) para até duas pessoas reais
// da equipe, com variação de duração, e uma sessão de hoje deixada em aberto (para ver o timer
// já rodando e testar pausar/encerrar). Tudo marcado com o prefixo [Demo] na nota, para a
// limpeza encontrar. Inserção sequencial (não em lote): o trigger de sequência do banco olha as
// linhas vizinhas a cada inserção, então a ordem cronológica importa.
// ---------------------------------------------------------------------------

/** Últimos `count` dias úteis antes de hoje, do mais antigo para o mais recente. */
function pastWeekdayOffsets(count: number): number[] {
  const offsets: number[] = [];
  let offset = -1;
  while (offsets.length < count) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) offsets.push(offset);
    offset -= 1;
  }
  return offsets.reverse();
}

async function insertTimeEntry(row: Tables["time_entries"]["Insert"]) {
  const { error } = await supabase.from("time_entries").insert(row);
  if (error) throw new Error(`time_entries: ${error.message}`);
}

async function seedWorkday(
  profileId: string,
  dayOffset: number,
  shift: { morningStart: string; morningEnd: string; afternoonStart: string; afternoonEnd: string },
  note: string,
) {
  const day = isoDay(dayOffset);
  await insertTimeEntry({ profile_id: profileId, kind: "entrada", occurred_at: toIsoFromLocal(day, shift.morningStart), source: "manual", note: `${PREFIX} ${note}` });
  await insertTimeEntry({ profile_id: profileId, kind: "saida", occurred_at: toIsoFromLocal(day, shift.morningEnd), source: "manual", note: `${PREFIX} ${note}` });
  await insertTimeEntry({ profile_id: profileId, kind: "entrada", occurred_at: toIsoFromLocal(day, shift.afternoonStart), source: "manual", note: `${PREFIX} ${note}` });
  await insertTimeEntry({ profile_id: profileId, kind: "saida", occurred_at: toIsoFromLocal(day, shift.afternoonEnd), source: "manual", note: `${PREFIX} ${note}` });
}

const REGULAR_SHIFT = { morningStart: "08:00", morningEnd: "12:00", afternoonStart: "13:00", afternoonEnd: "17:12" };
const SHORT_SHIFT = { morningStart: "08:00", morningEnd: "12:00", afternoonStart: "13:00", afternoonEnd: "15:30" };
const OVERTIME_SHIFT = { morningStart: "08:00", morningEnd: "12:30", afternoonStart: "13:30", afternoonEnd: "19:00" };

async function seedTimeEntries(personA: string, personB: string) {
  const offsetsA = pastWeekdayOffsets(19);
  for (const [index, offset] of offsetsA.entries()) {
    if (index === 5) await seedWorkday(personA, offset, SHORT_SHIFT, "Turno curto");
    else if (index === 12) await seedWorkday(personA, offset, OVERTIME_SHIFT, "Hora extra");
    else await seedWorkday(personA, offset, REGULAR_SHIFT, "Turno regular");
  }
  // Sessão de hoje em aberto: mostra o timer já rodando e permite testar pausar/encerrar/reload.
  // 2h atrás (não um horário fixo) para nunca cair no futuro, seja qual for a hora em que o seed rodar.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await insertTimeEntry({
    profile_id: personA,
    kind: "entrada",
    occurred_at: twoHoursAgo.toISOString(),
    source: "manual",
    note: `${PREFIX} Sessão de hoje`,
  });

  // Time pequeno (só o admin, por exemplo): pula a segunda pessoa para não duplicar o mesmo perfil.
  if (personB === personA) return;

  const offsetsB = pastWeekdayOffsets(20);
  for (const [index, offset] of offsetsB.entries()) {
    if (index === 8) await seedWorkday(personB, offset, SHORT_SHIFT, "Turno curto");
    else await seedWorkday(personB, offset, REGULAR_SHIFT, "Turno regular");
  }
}

console.log(`Alvo: ${new URL(env.data.NEXT_PUBLIC_SUPABASE_URL).host}`);

// ---------------------------------------------------------------------------
// Logos de clientes: PNG gerado aqui mesmo (sem dependência nova), monocromático — marcas
// geométricas simples em cinza claro sobre fundo transparente, enviadas ao bucket "company-logos".
// ---------------------------------------------------------------------------

const LOGO_BUCKET = "company-logos";
type LogoShape = "sol" | "ondas" | "bussola" | "barras";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Alfa (0–1) da forma no ponto (x, y) de um quadrado 0–1, com leve suavização de borda. */
function logoAlpha(shape: LogoShape, x: number, y: number): number {
  const cx = x - 0.5;
  const cy = y - 0.5;
  const r = Math.hypot(cx, cy);
  const edge = (distance: number) => Math.max(0, Math.min(1, 0.5 - distance * 256));
  switch (shape) {
    case "sol":
      // Disco + arco de horizonte.
      return Math.max(edge(r - 0.2), cy > 0.08 && cy < 0.14 && Math.abs(cx) < 0.36 ? 1 : 0);
    case "ondas": {
      const wave = (offset: number) => edge(Math.abs(cy - offset - 0.06 * Math.sin(cx * 14)) - 0.035);
      return Math.abs(cx) < 0.38 ? Math.max(wave(-0.14), wave(0), wave(0.14)) : 0;
    }
    case "bussola":
      // Losango vazado dentro de um anel.
      return Math.max(edge(Math.abs(r - 0.34) - 0.03), Math.abs(cx) + Math.abs(cy) < 0.22 && Math.abs(cx) + Math.abs(cy) > 0.12 ? 1 : 0);
    case "barras":
      return Math.abs(cx) < 0.34 && [-0.16, 0, 0.16].some((bar, index) => Math.abs(cy - bar) < 0.045 && cx < 0.34 - index * 0.12) ? 1 : 0;
  }
}

function logoPng(shape: LogoShape, size = 256): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const alpha = logoAlpha(shape, (x + 0.5) / size, (y + 0.5) / size);
      row.set([230, 230, 230, Math.round(alpha * 255)], 1 + x * 4);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function seedCompanyLogos(companies: { id: string; shape: LogoShape }[]) {
  for (const company of companies) {
    const path = `${company.id}/logo.png`;
    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, logoPng(company.shape), { upsert: true, contentType: "image/png" });
    if (error) {
      console.warn(`Logo não enviado (${error.message}). O bucket "${LOGO_BUCKET}" vem da migração 20260926100000 — rode supabase db push antes.`);
      return;
    }
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    fail("companies (logo)", (await supabase.from("companies").update({ logo_url: `${data.publicUrl}?v=${Date.now()}` }).eq("id", company.id)).error);
  }
}

// ---------------------------------------------------------------------------
// Quadro pessoal com três squads: pautas de produção (audiovisual) e tarefas avulsas do comercial
// e do financeiro, com e sem horário — para as visões Lista, Quadro e Calendário.
// ---------------------------------------------------------------------------

/** Instante de hoje + N dias, às HH:MM em Fortaleza (UTC-3, sem horário de verão). */
function fortalezaAt(dayOffset: number, time: string): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + dayOffset);
  return new Date(`${day.toISOString().slice(0, 10)}T${time}:00-03:00`).toISOString();
}

/** Dia (yyyy-mm-dd, Fortaleza) de hoje + N dias. */
function fortalezaDay(dayOffset: number): string {
  return fortalezaAt(dayOffset, "12:00").slice(0, 10);
}

async function seedMultiSquadPautas(users: Awaited<ReturnType<typeof seedHierarchyDemoUsers>>, projectId: string) {
  const me = users.multiSquad;
  const standalone = (row: Partial<Tables["pautas"]["Insert"]> & { title: string; squad: Database["public"]["Enums"]["squad"] }) =>
    ({ is_standalone: true, created_for: me, lead_id: me, current_assignee_id: me, priority: "media", ...row, title: `${PREFIX} ${row.title}` }) as Tables["pautas"]["Insert"];

  const rows: Tables["pautas"]["Insert"][] = [
    // Audiovisual — produção com horário (captação) e tarefa de revisão sem horário.
    {
      project_id: projectId,
      title: `${PREFIX} Captação — depoimentos da campanha`,
      status: "captacao",
      priority: "alta",
      lead_id: users.headAudiovisual,
      current_assignee_id: me,
      capture_type: ["video"],
      location_address: "Casa Aurora — loja do centro, Natal - RN",
      scheduled_at: fortalezaAt(1, "09:00"),
      duration_minutes: 150,
      due_date: fortalezaDay(4),
    } as Tables["pautas"]["Insert"],
    standalone({ title: "Revisar decupagem dos depoimentos", squad: "audiovisual", priority: "alta", due_date: fortalezaDay(2) }),
    // Comercial — atrasada, hoje, com horário (visita) e mais adiante.
    standalone({ title: "Retornar proposta da Studio Maré", squad: "comercial", priority: "urgente", due_date: fortalezaDay(-1) }),
    standalone({ title: "Atualizar funil da semana", squad: "comercial", due_date: fortalezaDay(0) }),
    standalone({ title: "Visita ao cliente — Agência Bússola", squad: "comercial", priority: "alta", scheduled_at: fortalezaAt(2, "15:00"), duration_minutes: 60, due_date: fortalezaDay(2) }),
    // Financeiro — atrasada urgente, hoje e daqui a 3 dias.
    standalone({ title: "Cobrar parcela em atraso — Studio Maré", squad: "financeiro", priority: "urgente", due_date: fortalezaDay(-2) }),
    standalone({ title: "Conferir notas fiscais do mês", squad: "financeiro", due_date: fortalezaDay(0) }),
    standalone({ title: "Conciliação bancária", squad: "financeiro", priority: "baixa", scheduled_at: fortalezaAt(3, "10:30"), duration_minutes: 90, due_date: fortalezaDay(3) }),
  ];
  for (const row of rows) await insertPauta(row);
}

// ---------------------------------------------------------------------------
// Agenda: compromissos nas próximas duas semanas (e um recente), cobrindo os quatro tipos, pessoas
// de squads diferentes, participantes externos, recorrência, um privado e uma captação vinculada
// a uma pauta existente (que então aparece só pelo compromisso).
// ---------------------------------------------------------------------------

async function seedAgendaDemo(
  users: Awaited<ReturnType<typeof seedHierarchyDemoUsers>>,
  ids: { aurora: string; mare: string; bussola: string; verao: string; institucional: string },
) {
  const { data: praia } = await supabase.from("pautas").select("id").eq("title", `${PREFIX} Captação — praia do Forte`).maybeSingle();
  const monday = (() => {
    const today = new Date(`${fortalezaDay(0)}T12:00:00Z`);
    return (today.getUTCDay() + 6) % 7;
  })();

  type Row = Tables["commitments"]["Insert"];
  const base = (owner: string, row: Omit<Row, "owner_id" | "created_by">): Row => ({ ...row, title: `${PREFIX} ${row.title}`, owner_id: owner, created_by: owner });

  const rows: Row[] = [
    base(users.headComercial, {
      title: "Reunião de briefing — Casa Aurora",
      kind: "reuniao_comercial",
      starts_at: fortalezaAt(1, "10:00"),
      ends_at: fortalezaAt(1, "11:00"),
      attendees: [users.sdr],
      external_attendees: [{ name: "Helena Duarte", email: "helena@demo.invalid" }],
      location_or_link: "https://meet.google.com/demo-aurora",
      company_id: ids.aurora,
    }),
    base(users.ceo, {
      title: "Apresentação de proposta — Agência Bússola",
      kind: "reuniao_comercial",
      starts_at: fortalezaAt(3, "15:00"),
      ends_at: fortalezaAt(3, "16:30"),
      attendees: [users.headComercial, users.multiSquad],
      external_attendees: [{ name: "Camila Rocha", email: "camila@demo.invalid" }],
      location_or_link: "Sede da Agência Bússola, Mossoró - RN",
      company_id: ids.bussola,
      reminder_minutes: [60],
    }),
    base(users.headComercial, {
      title: "Follow-up de proposta — Studio Maré",
      kind: "reuniao_comercial",
      starts_at: fortalezaAt(8, "11:00"),
      ends_at: fortalezaAt(8, "11:30"),
      attendees: [users.bdr],
      company_id: ids.mare,
    }),
    base(users.headAudiovisual, {
      title: "Captação — praia do Forte",
      kind: "captacao",
      starts_at: fortalezaAt(4, "06:00"),
      ends_at: fortalezaAt(4, "10:00"),
      attendees: [users.filmmaker],
      location_or_link: "Praia do Forte, Natal - RN",
      project_id: ids.verao,
      pauta_id: praia?.id ?? null,
    }),
    base(users.headAudiovisual, {
      title: "Captação — linha de produção Maré",
      kind: "captacao",
      starts_at: fortalezaAt(9, "08:00"),
      ends_at: fortalezaAt(9, "12:00"),
      attendees: [users.filmmaker, users.designer],
      location_or_link: "Sede da Studio Maré, Natal - RN",
      project_id: ids.institucional,
    }),
    base(users.headAudiovisual, {
      title: "Entrega — vídeo principal da Campanha Verão",
      kind: "entrega",
      all_day: true,
      starts_at: fortalezaAt(6, "00:00"),
      ends_at: fortalezaAt(6, "23:59"),
      attendees: [users.editor],
      project_id: ids.verao,
    }),
    base(users.headAudiovisual, {
      title: "Entrega — pacote mensal Maré",
      kind: "entrega",
      all_day: true,
      starts_at: fortalezaAt(12, "00:00"),
      ends_at: fortalezaAt(12, "23:59"),
      project_id: ids.institucional,
    }),
    base(users.headAudiovisual, {
      title: "Reunião de pauta semanal",
      kind: "interno",
      starts_at: fortalezaAt(-monday, "09:00"),
      ends_at: fortalezaAt(-monday, "10:00"),
      attendees: [users.filmmaker, users.editor, users.designer, users.multiSquad],
      recurrence_rule: "FREQ=WEEKLY",
      location_or_link: "Sala de reuniões",
    }),
    base(users.headComercial, {
      title: "Daily do comercial",
      kind: "interno",
      starts_at: fortalezaAt(0, "08:30"),
      ends_at: fortalezaAt(0, "08:45"),
      attendees: [users.sdr, users.bdr, users.atendimento],
      recurrence_rule: "FREQ=DAILY;COUNT=10",
      reminder_minutes: [10],
    }),
    base(users.headFinanceiro, {
      title: "Fechamento financeiro do mês",
      kind: "interno",
      starts_at: fortalezaAt(5, "14:00"),
      ends_at: fortalezaAt(5, "16:00"),
      attendees: [users.multiSquad, users.ceo],
      recurrence_rule: "FREQ=MONTHLY",
    }),
    base(users.filmmaker, {
      title: "Consulta médica",
      kind: "interno",
      starts_at: fortalezaAt(2, "14:00"),
      ends_at: fortalezaAt(2, "15:00"),
      visibility: "privado",
      reminder_minutes: [60],
    }),
    base(users.editor, {
      title: "Sessão de color grading",
      kind: "interno",
      starts_at: fortalezaAt(2, "14:30"),
      ends_at: fortalezaAt(2, "17:30"),
      project_id: ids.verao,
    }),
    base(users.ceo, {
      title: "Almoço com a Casa Aurora",
      kind: "reuniao_comercial",
      status: "realizado",
      starts_at: fortalezaAt(-2, "12:00"),
      ends_at: fortalezaAt(-2, "13:30"),
      company_id: ids.aurora,
    }),
  ];

  fail("commitments (agenda demo)", (await supabase.from("commitments").insert(rows)).error);
}

(wantsClean ? clean() : seed()).catch((error: unknown) => {
  console.error("Falha:", error instanceof Error ? error.message : error);
  process.exit(1);
});
