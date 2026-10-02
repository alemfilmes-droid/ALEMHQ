import { SQUADS } from "@/lib/auth/squads";
import type { AccessRole, OrgLevel, Profile, Squad } from "@/types";

/**
 * Fonte única de permissões. Usada pelo middleware (rotas), pela sidebar
 * (visibilidade) e pelas server actions (ações).
 * Não importe nada de UI aqui: este arquivo roda no Edge runtime.
 *
 * Duas camadas independentes:
 * - ACTION_ACCESS: por papel (access_role). Só administração de equipe.
 * - CAPABILITIES: por squad/flag do profile, não pelo papel — financeiro,
 *   gestão de projetos e gestão de empresas/contatos.
 */

const ALL_ROLES: readonly AccessRole[] = ["admin", "coordinator", "member", "freelancer", "sdr", "bdr"];
const INTERNAL_ROLES: readonly AccessRole[] = ["admin", "coordinator", "member", "sdr", "bdr"];
const ADMIN_ONLY: readonly AccessRole[] = ["admin"];

/** Prefixo de rota → papéis permitidos. Rotas sem regra exigem apenas login. */
export const ROUTE_ACCESS: Record<string, readonly AccessRole[]> = {
  "/inicio": ALL_ROLES,
  "/perfil": ALL_ROLES,
  // Manifesto, Valores e Cultura: leitura para todo mundo (edição futura: capability "manageCompany").
  "/essencia": ALL_ROLES,
  // Quadro pessoal: todo mundo tem o seu, independente de papel ou nível hierárquico.
  "/minhas-pautas": ALL_ROLES,
  "/agenda": ALL_ROLES,
  "/projetos": ALL_ROLES,
  // O quadro global exige a capability "managePautas" (ver CAPABILITY_ROUTES) — quem não gerencia
  // pautas nem chega a ver a rota; é redirecionado para /minhas-pautas (ver middleware.ts).
  "/pautas": ALL_ROLES,
  "/clientes": INTERNAL_ROLES,
  // O papel não decide: a rota exige a capability "crm" (ver CAPABILITY_ROUTES) — squad comercial,
  // qualquer head, diretoria ou master. Igual a /pautas, um head fora do squad comercial acessa a
  // rota mas a RLS de deals devolve um funil vazio (ver can_access_all_deals() no banco).
  "/crm": ALL_ROLES,
  "/avisos": INTERNAL_ROLES,
  // O quadro de squads é de leitura para todos; ações (convidar, editar, desativar) exigem admin
  // e são checadas dentro da página e das server actions (team:*), não na rota.
  "/equipe": ALL_ROLES,
  "/configuracoes": INTERNAL_ROLES,
  // O papel não decide: a rota exige a capability "finance" (ver CAPABILITY_ROUTES).
  "/financeiro": ALL_ROLES,
  // Banco de horas é de todo mundo; a aba "Equipe" (diretoria/admin) é escondida na própria página.
  "/banco-de-horas": ALL_ROLES,
  // Orçamentos: só o master (capability "budgets"; a RLS repete com is_master()).
  "/orcamentos": ALL_ROLES,
};

/** Rotas que dependem de uma capability (squad/flag do profile), além do papel. */
export const CAPABILITY_ROUTES: Record<string, Capability> = {
  "/financeiro": "finance",
  "/pautas": "managePautas",
  "/crm": "crm",
  "/orcamentos": "budgets",
};

export const ACTION_ACCESS = {
  "team:view-admin": ADMIN_ONLY,
  "team:invite": ADMIN_ONLY,
  "team:edit": ADMIN_ONLY,
  "team:deactivate": ADMIN_ONLY,
} as const satisfies Record<string, readonly AccessRole[]>;

export type Action = keyof typeof ACTION_ACCESS;

export const DEFAULT_ROUTE = "/inicio";

export const PUBLIC_ROUTES = [
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/aceitar-convite",
  "/auth/confirm",
  "/privacidade",
  "/termos",
] as const;

/** Páginas que só fazem sentido sem sessão: usuário logado é redirecionado. */
export const GUEST_ONLY_ROUTES = ["/login", "/esqueci-senha"] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => matchesPrefix(pathname, route));
}

export function isGuestOnlyRoute(pathname: string) {
  return GUEST_ONLY_ROUTES.some((route) => matchesPrefix(pathname, route));
}

export function canAccessRoute(role: AccessRole, pathname: string) {
  const rule = Object.entries(ROUTE_ACCESS).find(([prefix]) => matchesPrefix(pathname, prefix));
  return rule ? rule[1].includes(role) : true;
}

export function can(role: AccessRole, action: Action) {
  return (ACTION_ACCESS[action] as readonly AccessRole[]).includes(role);
}

/**
 * Capacidades por squad/flag — nunca pelo papel. Espelham exatamente as regras
 * de RLS (has_finance_access(), is_director(), in_squad('comercial')).
 *
 * - "finance": diretoria ou financeiro têm acesso automaticamente; a coluna
 *   has_finance_access é só a exceção manual pontual. Ser admin NÃO concede.
 * - "manageProjects": só diretoria cria, edita ou arquiva projetos.
 * - "manageCompanies": diretoria ou comercial cadastram e editam empresas/contatos.
 * - "managePautas": acesso à ROTA /pautas — espelha can_manage_pautas() no banco (nível
 *   hierárquico master/diretoria/head, não mais squad). O que a pessoa pode fazer DENTRO do
 *   quadro (criar, mudar líder/prioridade) é mais estrito — ver canFullyManagePauta() abaixo,
 *   que espelha can_fully_manage_pauta() no banco (a mesma capability, restrita ao squad que de
 *   fato produz pautas hoje).
 * - "crm": acesso à ROTA /crm — squad comercial (SDR/BDR) ou qualquer nível master/diretoria/head,
 *   mesmo padrão de "managePautas". O que a pessoa vê DENTRO do funil (só os próprios negócios, ou
 *   todos) é mais estrito e vem da RLS de `deals` — ver canManageAllDeals() abaixo, que espelha
 *   can_access_all_deals() no banco (restrito a diretoria/master ou head do squad comercial).
 * - "canSeeFinanceHomeCard": só diretoria vê o card financeiro em /inicio. O squad financeiro
 *   mantém acesso total a /financeiro e a todos os dados (capability "finance", inalterada) —
 *   só não aparece o atalho na home. Regra separada e nomeada de propósito, para ficar óbvia.
 */
type CapabilitySubject = Pick<Profile, "has_finance_access" | "org_level"> & {
  squads: readonly Squad[];
  /** Squads em que a pessoa é líder (profile_squads.is_lead) — uma pessoa pode liderar mais de um. */
  leadSquads?: readonly Squad[];
};

const CAPABILITIES = {
  finance: (subject: CapabilitySubject) =>
    subject.squads.includes("diretoria") || subject.squads.includes("financeiro") || subject.has_finance_access,
  manageProjects: (subject: CapabilitySubject) => subject.squads.includes("diretoria"),
  manageCompanies: (subject: CapabilitySubject) => subject.squads.includes("diretoria") || subject.squads.includes("comercial"),
  managePautas: (subject: CapabilitySubject) =>
    subject.org_level === "master" || subject.org_level === "diretoria" || subject.org_level === "head",
  crm: (subject: CapabilitySubject) =>
    subject.org_level === "master" ||
    subject.org_level === "diretoria" ||
    subject.org_level === "head" ||
    subject.squads.includes("comercial"),
  canSeeFinanceHomeCard: (subject: CapabilitySubject) => subject.squads.includes("diretoria"),
  /** Visão gerencial do comercial em /inicio (valor em negociação, propostas, ganhos do mês). */
  crmOverview: (subject: CapabilitySubject) =>
    subject.org_level === "master" || subject.org_level === "diretoria" || subject.squads.includes("diretoria"),
  /** "Meu dia comercial" em /inicio: quem trabalha negócios (squad comercial ou liderança do comercial). */
  crmWorkday: (subject: CapabilitySubject) =>
    subject.squads.includes("comercial") || (subject.leadSquads?.includes("comercial") ?? false),
  /**
   * Administração da empresa: criar/agendar/arquivar avisos, editar as configurações da empresa
   * (jornada, margem, comissões) e, no futuro, os textos da Essência. Espelha can_manage_company()
   * no banco: master, nível diretoria ou squad diretoria.
   */
  manageCompany: (subject: CapabilitySubject) =>
    subject.org_level === "master" || subject.org_level === "diretoria" || subject.squads.includes("diretoria"),
  /** Painel de orçamentos e propostas comerciais: só o master. */
  budgets: (subject: CapabilitySubject) => subject.org_level === "master",
} as const;

export type Capability = keyof typeof CAPABILITIES;

export function hasCapability(subject: CapabilitySubject, capability: Capability) {
  return CAPABILITIES[capability](subject);
}

/** Papel + capabilities. Usado pelo middleware e pela sidebar. */
export function canAccessRouteFor(subject: Pick<Profile, "access_role"> & CapabilitySubject, pathname: string) {
  if (!canAccessRoute(subject.access_role, pathname)) return false;
  const required = Object.entries(CAPABILITY_ROUTES).find(([prefix]) => matchesPrefix(pathname, prefix));
  return required ? hasCapability(subject, required[1]) : true;
}

/**
 * Diretoria ou admin: quem pode ver a aba "Equipe" do banco de horas e definir a carga horária de
 * outra pessoa. Espelha exatamente a RLS de work_schedules (is_director() or is_admin()) — não é
 * uma capability porque depende do papel, não só de squad/flag.
 */
export function canManageTimeTracking(subject: Pick<Profile, "access_role"> & { squads: readonly Squad[] }) {
  return subject.access_role === "admin" || subject.squads.includes("diretoria");
}

/**
 * Troca do logo de um cliente: diretoria, squad comercial ou admin. Espelha
 * can_manage_company_logos() no banco (RPC set_company_logo e policies do bucket "company-logos").
 */
export function canManageCompanyLogos(subject: Pick<Profile, "access_role"> & { squads: readonly Squad[] }) {
  return subject.access_role === "admin" || subject.squads.includes("diretoria") || subject.squads.includes("comercial");
}

/**
 * Filtro "pessoa" na agenda: diretoria, master e heads. É só UI — o que cada um enxerga de fato vem
 * do feed agenda_feed() e da RLS de commitments (privado de outra pessoa sai como "Ocupado").
 */
export function canFilterAgendaByPerson(subject: Pick<Profile, "org_level"> & { squads: readonly Squad[] }) {
  return subject.org_level === "master" || subject.org_level === "diretoria" || subject.org_level === "head" || subject.squads.includes("diretoria");
}

type HierarchySubject = Pick<Profile, "org_level"> & { squads: readonly Squad[] };

/** Espelha managed_squads() no banco: todos os squads para master/diretoria, os próprios para head, nenhum para executor. */
export function managedSquads(subject: HierarchySubject): readonly Squad[] {
  if (subject.org_level === "master" || subject.org_level === "diretoria") return SQUADS;
  if (subject.org_level === "head") return subject.squads;
  return [];
}

/**
 * Criar "Pauta de projeto" e atribuir outras pessoas: espelha a policy pautas_insert (can_manage_pautas()
 * no banco) — master, diretoria e heads. Quem não pode só cria "Tarefa interna" para si. Vale SÓ para
 * pautas: SDR/BDR continuam criando empresas, contatos e negócios no CRM normalmente.
 */
export function canCreateProjectPauta(subject: Pick<Profile, "org_level">): boolean {
  return subject.org_level === "master" || subject.org_level === "diretoria" || subject.org_level === "head";
}

/**
 * Cadastrar e editar freelancers (sem conta no sistema): admin, diretoria, master e heads — espelha
 * can_manage_freelancers() no banco.
 */
export function canManageFreelancers(subject: Pick<Profile, "access_role" | "org_level"> & { squads: readonly Squad[] }): boolean {
  return subject.access_role === "admin" || subject.squads.includes("diretoria") || canCreateProjectPauta(subject);
}

/**
 * Apagar projetos: master, diretoria (nível ou squad) e heads — espelha can_delete_project() no banco,
 * que ainda exige acesso ao financeiro quando o projeto já tem recebimentos/pagamentos.
 */
export function canDeleteProject(subject: Pick<Profile, "org_level"> & { squads: readonly Squad[] }): boolean {
  return canCreateProjectPauta(subject) || subject.squads.includes("diretoria");
}

/**
 * Espelha can_fully_manage_pauta() no banco: gestão de verdade sobre pautas (criar, apagar,
 * trocar líder/prioridade, mover entre colunas livremente, reatribuir responsáveis à força) —
 * capability "managePautas" (acesso à rota) restrita ao squad que de fato produz pautas hoje.
 */
export function canFullyManagePauta(subject: CapabilitySubject): boolean {
  return hasCapability(subject, "managePautas") && managedSquads(subject).includes("audiovisual");
}

/**
 * Espelha can_access_all_deals() no banco: gestão de todos os negócios do CRM (ver qualquer
 * negócio, reatribuir responsável, fechar como ganho) — diretoria, master, ou head do squad
 * comercial, ou quem lidera o squad comercial (liderança de squad, não cargo). Quem não se encaixa
 * aqui só enxerga os negócios em que é dono ou responsável atual.
 */
export function canManageAllDeals(subject: HierarchySubject & CapabilitySubject): boolean {
  return (
    subject.org_level === "master" ||
    subject.squads.includes("diretoria") ||
    (subject.org_level === "head" && managedSquads(subject).includes("comercial")) ||
    (subject.leadSquads?.includes("comercial") ?? false)
  );
}

/** Espelha can_manage_profile() no banco — usado só para decidir o que a UI mostra; a RLS é quem decide de verdade. */
export function canManageOrgLevel(actorId: string, actor: HierarchySubject, target: HierarchySubject & { id: string }): boolean {
  if (target.id === actorId) return false;
  if (actor.org_level === "master") return true;
  if (actor.org_level === "diretoria") return target.org_level === "head" || target.org_level === "executor";
  if (actor.org_level === "head") return target.org_level === "executor" && target.squads.some((squad) => actor.squads.includes(squad));
  return false;
}

/** Níveis que a pessoa pode atribuir a alguém (o próprio nível nunca está na lista — nem para master). */
export function assignableOrgLevels(actor: Pick<Profile, "org_level">): OrgLevel[] {
  if (actor.org_level === "master") return ["diretoria", "head", "executor"];
  if (actor.org_level === "diretoria") return ["head", "executor"];
  if (actor.org_level === "head") return ["executor"];
  return [];
}
