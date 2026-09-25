import type { AccessRole, ProductionFunction } from "@/types";

export const ACCESS_ROLES = [
  "admin",
  "coordinator",
  "member",
  "freelancer",
  "sdr",
  "bdr",
] as const satisfies readonly AccessRole[];

export const PRODUCTION_FUNCTIONS = [
  "captacao",
  "edicao",
  "direcao",
  "roteiro",
  "motion",
  "producao",
  "fotografia",
] as const satisfies readonly ProductionFunction[];

export const ROLE_LABELS: Record<AccessRole, string> = {
  admin: "Administração",
  coordinator: "Coordenação",
  member: "Membro",
  freelancer: "Freelancer",
  sdr: "SDR",
  bdr: "BDR",
};

export const FUNCTION_LABELS: Record<ProductionFunction, string> = {
  captacao: "Captação",
  edicao: "Edição",
  direcao: "Direção",
  roteiro: "Roteiro",
  motion: "Motion",
  producao: "Produção",
  fotografia: "Fotografia",
};
