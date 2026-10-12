import type { MessageLead, MessagePlaybook, ScriptRow } from "@/lib/prospeccao/message";

/** Dados de teste da mensagem (só os testes importam). */
export const PLAYBOOK: MessagePlaybook = {
  id: "pb-matricula",
  touchZeroVariant: "escola_matricula_recorrente",
  linkBase: "https://www.alemfilmes.com.br/institucional",
  linkAppendsSchoolParam: true,
  caseText: null,
};

export const SCRIPTS: ScriptRow[] = [
  { id: "t0-mat", kind: "toque_zero", playbookId: null, touchNumber: null, touchZeroVariant: "escola_matricula_recorrente", audience: null, body: "{saudacao}. Preciso falar com quem decide." },
  { id: "t0-esp", kind: "toque_zero", playbookId: null, touchNumber: null, touchZeroVariant: "escola_espetaculos", audience: null, body: "{saudacao}. Espetáculos." },
  { id: "sg-esc", kind: "sem_gancho", playbookId: null, touchNumber: null, touchZeroVariant: null, audience: "escola", body: "{nome}, quem cuida dos vídeos do {escola}?" },
  { id: "sg-emp", kind: "sem_gancho", playbookId: null, touchNumber: null, touchZeroVariant: null, audience: "empresa", body: "{nome}, quem cuida dos vídeos da {empresa}?" },
  { id: "casa-esc", kind: "cliente_da_casa", playbookId: null, touchNumber: null, touchZeroVariant: null, audience: "escola", body: "Olá, {nome}. Depois do {ultimo_projeto}…" },
  { id: "t1", kind: "toque", playbookId: "pb-matricula", touchNumber: 1, touchZeroVariant: null, audience: null, body: "{nome}, vi o perfil do {escola} e {gancho}." },
  { id: "t2", kind: "toque", playbookId: "pb-matricula", touchNumber: 2, touchZeroVariant: null, audience: null, body: "{nome}, preparei uma página:\n{link}" },
  { id: "reat", kind: "reativacao", playbookId: "pb-matricula", touchNumber: null, touchZeroVariant: null, audience: null, body: "{nome}, retomando: agenda de {mês}." },
];

export const LEAD: MessageLead = {
  name: "Colégio São José",
  audience: "escola",
  contactName: "Secretaria",
  contactPhone: "84 3201-0000",
  contactIsDecisionMaker: false,
  decisionMakerName: "Mariana Souza",
  decisionMakerWhatsapp: "(84) 99988-7766",
  hook: "vi a unidade nova",
  lastDeliveredProject: null,
};
