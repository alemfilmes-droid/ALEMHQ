import { z } from "zod";
import { CREDENTIAL_WARNING, hasCredential } from "@/features/processes/credentials";
import { ACTION_KINDS, PROCESS_FREQUENCIES, STEP_TOOLS, STEP_TYPES, SYSTEM_AREAS } from "@/features/processes/types";
import { SQUADS } from "@/lib/auth/squads";

/** Texto livre que nunca pode carregar credencial. */
const safeText = (max: number, required?: string) => {
  const base = z.string().trim().max(max, `Use até ${max} caracteres.`);
  return (required ? base.min(2, required) : base).refine((value) => !hasCredential(value), CREDENTIAL_WARNING);
};

export const processSchema = z.object({
  title: safeText(160, "Informe o título."),
  squad: z.enum(SQUADS),
  summary: safeText(1000),
  triggerDescription: safeText(500),
  frequency: z.enum(PROCESS_FREQUENCIES),
  ownerRole: safeText(120),
  isPublished: z.boolean(),
});

export type ProcessValues = z.infer<typeof processSchema>;

export const stepSchema = z
  .object({
    title: safeText(200, "Informe o título do passo."),
    description: safeText(5000),
    responsibleRole: safeText(120),
    systemArea: z.enum(SYSTEM_AREAS),
    systemLink: z
      .string()
      .trim()
      .max(500)
      .refine((value) => value === "" || /^(\/[A-Za-z0-9/_?=&#%.-]*|https?:\/\/\S+)$/.test(value), "Use uma rota do sistema (/clientes) ou um endereço https://.")
      .refine((value) => !hasCredential(value), CREDENTIAL_WARNING),
    doneCriteria: safeText(1000),
    estimatedMinutes: z
      .string()
      .trim()
      .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1440), "De 1 a 1440 minutos."),
    isBlocking: z.boolean(),
    tool: z.enum(STEP_TOOLS).or(z.literal("")),
    stepType: z.enum(STEP_TYPES),
    actionKind: z.enum(ACTION_KINDS),
    branchYesStepId: z.string().uuid().or(z.literal("")),
    branchNoStepId: z.string().uuid().or(z.literal("")),
    imageUrl: z.string().trim().max(500).refine((value) => value === "" || /^https:\/\//.test(value), "Imagem inválida.").or(z.literal("")),
    exampleText: safeText(2000),
  })
  .refine((values) => values.stepType !== "decisao" || (values.branchYesStepId !== "" && values.branchNoStepId !== ""), {
    message: "Decisão precisa das duas saídas: para onde vai o “Sim” e o “Não”.",
    path: ["branchNoStepId"],
  })
  .refine((values) => values.systemArea !== "externo" || values.systemLink === "" || /^https?:\/\//.test(values.systemLink), {
    message: "Sistema externo usa um endereço https://.",
    path: ["systemLink"],
  });

export type StepValues = z.infer<typeof stepSchema>;

/** "Faturamento do mês" → "financeiro-faturamento-do-mes". */
export function slugify(squad: string, title: string): string {
  const base = `${squad} ${title}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return base || "processo";
}
