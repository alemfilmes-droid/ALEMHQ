import type { ScriptVariable } from "@/lib/prospeccao/render";
import type {
  ProspectAudience,
  ProspectCadenceType,
  ProspectHolidayScope,
  ProspectObjectionAction,
  ProspectTouchZeroVariant,
} from "@/types";

export const AUDIENCES = ["escola", "empresa"] as const satisfies readonly ProspectAudience[];
export const AUDIENCE_LABELS: Record<ProspectAudience, string> = { escola: "Escolas", empresa: "Empresas" };

export const CADENCE_TYPES = ["sazonal", "relacionamento"] as const satisfies readonly ProspectCadenceType[];
export const CADENCE_TYPE_LABELS: Record<ProspectCadenceType, string> = { sazonal: "Sazonal", relacionamento: "Relacionamento" };

export const TOUCH_ZERO_VARIANTS = ["escola_matricula_recorrente", "escola_espetaculos", "empresa"] as const satisfies readonly ProspectTouchZeroVariant[];
export const TOUCH_ZERO_VARIANT_LABELS: Record<ProspectTouchZeroVariant, string> = {
  escola_matricula_recorrente: "Escolas · Matrícula e Recorrente",
  escola_espetaculos: "Escolas · Espetáculos",
  empresa: "Empresas · todos os playbooks",
};

export const OBJECTION_ACTIONS = ["registrar", "pedir_data_reativacao", "novo_decisor"] as const satisfies readonly ProspectObjectionAction[];
export const OBJECTION_ACTION_LABELS: Record<ProspectObjectionAction, string> = {
  registrar: "Registrar objeção",
  pedir_data_reativacao: "Pedir data e agendar reativação",
  novo_decisor: "Abrir cadastro de novo decisor no mesmo lead",
};

export const HOLIDAY_SCOPES = ["nacional", "rn", "natal"] as const satisfies readonly ProspectHolidayScope[];
export const HOLIDAY_SCOPE_LABELS: Record<ProspectHolidayScope, string> = { nacional: "Nacional", rn: "RN", natal: "Natal" };

export const VARIABLE_HINTS: Record<ScriptVariable, string> = {
  saudacao: "Bom dia, Boa tarde ou Boa noite, pela hora do envio",
  nome: "Primeiro nome do decisor",
  escola: "Nome do lead (escolas)",
  empresa: "Nome do lead (empresas)",
  gancho: "Observação curta sobre o lead",
  link: "Link do playbook (com ?escola= quando ativado)",
  case: "Texto do case do playbook",
  mês: "Mês seguinte ao envio, por extenso",
  ano_seguinte: "Ano seguinte ao envio",
  ultimo_projeto: "Último projeto entregue ao cliente",
  horario_1: "Primeiro horário sugerido para a reunião (ex.: terça (14/10) às 9h)",
  horario_2: "Segundo horário sugerido para a reunião",
};

export const PROSPECTING_TABS = [
  { id: "geral", label: "Geral" },
  { id: "playbooks", label: "Playbooks" },
  { id: "scripts", label: "Scripts" },
  { id: "cadencias", label: "Cadências" },
  { id: "objecoes", label: "Objeções" },
  { id: "feriados", label: "Feriados" },
  { id: "metas", label: "Playbook → Meta" },
] as const;

export type ProspectingTab = (typeof PROSPECTING_TABS)[number]["id"];

export const PROSPECTING_PATH = "/configuracoes/prospeccao";
