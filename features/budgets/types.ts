import { z } from "zod";
import type { BudgetLineInput } from "@/features/budgets/pricing";

export type BudgetStatus = "rascunho" | "enviado" | "em_ajuste" | "aprovado" | "recusado";

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado ao cliente",
  em_ajuste: "Em ajuste",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const PROPOSAL_TEMPLATES = ["manifesto", "executivo", "tratamento"] as const;
export type ProposalTemplate = (typeof PROPOSAL_TEMPLATES)[number];

export const PROPOSAL_TEMPLATE_INFO: Record<ProposalTemplate, { name: string; description: string; flow: string[] }> = {
  manifesto: {
    name: "Manifesto",
    description: "Institucional e cinematográfico. Abre com quem somos e a mente por trás da Além; ideal para marcas novas e projetos de posicionamento.",
    flow: ["Capa", "Manifesto da Além", "A mente por trás", "O desafio", "A ideia", "Referências", "Entregáveis", "Cronograma", "Investimento", "Próximos passos"],
  },
  executivo: {
    name: "Executivo",
    description: "Direto ao ponto, para quem decide rápido: apresentação curta, objetivo, escopo, equipe, prazo e investimento.",
    flow: ["Capa", "Quem somos", "Objetivo", "Escopo e entregáveis", "Equipe dedicada", "Cronograma", "Investimento", "Condições e contato"],
  },
  tratamento: {
    name: "Tratamento do diretor",
    description: "Formato de tratamento de produtora de cinema publicitário: carta do diretor, conceito, narrativa e linguagem visual. Para campanhas criativas.",
    flow: ["Capa", "A Além e o diretor", "Carta do diretor", "Contexto e público", "Narrativa", "Linguagem visual", "Produção", "Entregáveis", "Investimento", "Encerramento"],
  },
};

/** Conteúdo da apresentação de um orçamento (budgets.presentation). */
export const presentationSchema = z.object({
  template: z.enum(PROPOSAL_TEMPLATES).default("manifesto"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#E5231B"),
  clientLogoUrl: z.string().url().or(z.literal("")).default(""),
  context: z.string().max(2000).default(""),
  objective: z.string().max(2000).default(""),
  concept: z.string().max(3000).default(""),
  narrative: z.string().max(3000).default(""),
  deliverables: z.array(z.string().max(200)).max(20).default([]),
  timeline: z.array(z.object({ step: z.string().max(120), when: z.string().max(60) })).max(12).default([]),
  references: z.array(z.string().url()).max(8).default([]),
  closing: z.string().max(1000).default(""),
});

export type PresentationContent = z.infer<typeof presentationSchema>;

export function parsePresentation(value: unknown): PresentationContent {
  const parsed = presentationSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : presentationSchema.parse({});
}

/** Perfil comercial da Além (company_settings.proposal_profile). */
export const proposalProfileSchema = z.object({
  tagline: z.string().max(120).default("Visão além do óbvio."),
  about: z.string().max(2000).default(""),
  manifesto: z.string().max(2000).default(""),
  founderName: z.string().max(120).default(""),
  founderRole: z.string().max(120).default("Fundador e diretor criativo"),
  founderBio: z.string().max(2000).default(""),
  founderPhotoUrl: z.string().url().or(z.literal("")).default(""),
  proof: z.string().max(300).default(""),
  clients: z.string().max(500).default(""),
  contactEmail: z.string().max(160).default(""),
  contactPhone: z.string().max(60).default(""),
  website: z.string().max(160).default("alemfilmes.com.br"),
  instagram: z.string().max(80).default("@alemfilmes"),
});

export type ProposalProfile = z.infer<typeof proposalProfileSchema>;

export function parseProposalProfile(value: unknown): ProposalProfile {
  const parsed = proposalProfileSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : proposalProfileSchema.parse({});
}

export interface BudgetRecord {
  id: string;
  number: number;
  version: number;
  parentId: string | null;
  projectId: string | null;
  projectName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  deliverables: string[];
  sentAt: string | null;
  decidedAt: string | null;
  statusNote: string;
  companyId: string | null;
  companyLogoUrl: string | null;
  clientName: string;
  title: string;
  issueDate: string;
  validUntil: string;
  feePct: number;
  taxPct: number;
  status: BudgetStatus;
  paymentTerms: string;
  notes: string;
  presentation: PresentationContent;
  items: BudgetLineInput[];
}

export interface CatalogItem {
  id: string;
  position: number;
  section: "profissional" | "custo";
  name: string;
  unit: string;
  defaultCost: number;
  active: boolean;
}
