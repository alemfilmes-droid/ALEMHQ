import {
  Building2,
  Calculator,
  Landmark,
  CalendarDays,
  Clock,
  FolderKanban,
  Home,
  KanbanSquare,
  ListChecks,
  Megaphone,
  Settings,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { canAccessRouteFor } from "@/lib/auth/permissions";
import type { Profile, Squad } from "@/types";

export type NavProfile = Pick<Profile, "access_role" | "has_finance_access" | "org_level"> & { squads: readonly Squad[] };

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Módulo ainda não construído: renderiza "Em construção". */
  placeholder?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/inicio", label: "Início", icon: Home },
      { href: "/minhas-pautas", label: "Minhas Pautas", icon: ListChecks },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/clientes", label: "Clientes", icon: Building2 },
      { href: "/projetos", label: "Projetos", icon: FolderKanban },
      { href: "/pautas", label: "Pautas", icon: KanbanSquare },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/crm", label: "CRM", icon: TrendingUp },
      { href: "/orcamentos", label: "Orçamentos", icon: Calculator },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    label: "Empresa",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: Landmark },
      { href: "/banco-de-horas", label: "Banco de Horas", icon: Clock },
      { href: "/equipe", label: "Equipe", icon: Users },
      { href: "/avisos", label: "Avisos", icon: Megaphone },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

/** Itens visíveis (papel + capabilities), reaproveitando o mesmo mapa de permissões do middleware. */
export function getNavGroupsForProfile(profile: NavProfile): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessRouteFor(profile, item.href)),
  })).filter((group) => group.items.length > 0);
}

/** Item de navegação de uma rota (ícone e rótulo) — usado pelo ícone do cabeçalho de cada painel. */
export function findNavItem(href: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((group) => group.items).find((item) => item.href === href);
}

const EXTRA_TITLES: Record<string, string> = { "/perfil": "Perfil", "/essencia": "Essência" };

export function getPageTitle(pathname: string): string | null {
  for (const [href, title] of Object.entries(EXTRA_TITLES)) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return title;
  }
  const item = NAV_GROUPS.flatMap((group) => group.items).find(
    (candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  );
  return item?.label ?? null;
}
