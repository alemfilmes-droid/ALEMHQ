import { z } from "zod";
import { parseMoneyToCents } from "@/features/finance/money";
import { BANK_ACCOUNT_TYPES, DEAL_METRICS, GOAL_METRICS, PAYOUT_METHODS, PIX_KEY_TYPES } from "@/features/goals/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

/** Número digitado ("1.234,56", "40", "12,5") → centésimos; null se inválido. */
export const parseHundredths = parseMoneyToCents;

const positiveNumber = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => {
      const parsed = parseHundredths(value);
      return parsed !== null && parsed > 0;
    }, "Informe um número maior que zero.");

const nonNegativeNumber = z
  .string()
  .trim()
  .refine((value) => value === "" || parseHundredths(value) !== null, "Informe um número válido.");

const optionalText = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);

export const goalSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título.").max(160, "Use até 160 caracteres."),
    description: optionalText(2000),
    ownerId: z.string().uuid("Escolha o responsável."),
    metric: z.enum(GOAL_METRICS, { message: "Escolha a métrica." }),
    unitLabel: optionalText(40),
    isMoney: z.boolean(),
    target: positiveNumber("Informe o alvo."),
    startsOn: isoDate,
    endsOn: isoDate,
    commissionMode: z.enum(["percentual", "por_unidade", "contratos_fechados"]),
    commissionRate: nonNegativeNumber,
    /** contratos_fechados: % pago abaixo do mínimo (comissão fixa). */
    fallbackRate: nonNegativeNumber,
    minAchievementPct: z
      .string()
      .trim()
      .refine((value) => {
        const parsed = parseHundredths(value);
        return parsed !== null && parsed <= 10000;
      }, "Use de 0 a 100."),
    autoFromCrm: z.boolean(),
  })
  .refine((values) => values.endsOn >= values.startsOn, { message: "O fim precisa ser depois do início.", path: ["endsOn"] })
  .refine((values) => values.commissionMode !== "percentual" || values.metric === "vendas_valor" || (values.metric === "personalizada" && values.isMoney), {
    message: "Percentual só vale para metas em R$. Use valor por unidade.",
    path: ["commissionMode"],
  })
  .refine((values) => values.commissionMode !== "contratos_fechados" || DEAL_METRICS.includes(values.metric), {
    message: "Contratos fechados valem para metas de negócios, reuniões ou vendas fechadas.",
    path: ["commissionMode"],
  })
  .refine((values) => values.commissionMode !== "contratos_fechados" || values.autoFromCrm, {
    message: "Ligue “Alimentar pelo CRM”: cada conta lançada precisa ser um negócio do CRM.",
    path: ["autoFromCrm"],
  })
  .refine((values) => (parseHundredths(values.fallbackRate || "0") ?? 0) <= 10000, { message: "Use de 0 a 100%.", path: ["fallbackRate"] })
  .refine((values) => values.commissionMode === "por_unidade" || (parseHundredths(values.commissionRate || "0") ?? 0) <= 10000, {
    message: "Use de 0 a 100%.",
    path: ["commissionRate"],
  })
  .refine((values) => values.metric !== "personalizada" || values.isMoney || values.unitLabel.length > 0, {
    message: "Diga a unidade (ex.: leads, posts).",
    path: ["unitLabel"],
  });

export type GoalValues = z.infer<typeof goalSchema>;

export const entrySchema = z.object({
  amount: positiveNumber("Informe o valor."),
  entryDate: isoDate,
  note: optionalText(1000),
  linkUrl: z
    .string()
    .trim()
    .max(500, "Use até 500 caracteres.")
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use um link começando com http:// ou https://."),
});

export type EntryValues = z.infer<typeof entrySchema>;

export const paymentDetailsSchema = z
  .object({
    preferredMethod: z.enum(PAYOUT_METHODS),
    holderName: optionalText(160),
    holderDocument: optionalText(20),
    pixKeyType: z.enum(PIX_KEY_TYPES).or(z.literal("")),
    pixKey: optionalText(160),
    bankName: optionalText(120),
    bankCode: optionalText(10),
    agency: optionalText(20),
    accountNumber: optionalText(30),
    accountType: z.enum(BANK_ACCOUNT_TYPES).or(z.literal("")),
    notes: optionalText(1000),
  })
  .refine((values) => values.preferredMethod !== "pix" || values.pixKey.length > 0, {
    message: "Informe a chave Pix.",
    path: ["pixKey"],
  })
  .refine((values) => values.pixKey.length === 0 || values.pixKeyType !== "", {
    message: "Escolha o tipo da chave.",
    path: ["pixKeyType"],
  })
  .refine((values) => values.preferredMethod !== "transferencia" || (values.bankName.length > 0 && values.agency.length > 0 && values.accountNumber.length > 0), {
    message: "Para transferência, informe banco, agência e conta.",
    path: ["accountNumber"],
  })
  .refine((values) => values.holderName.length > 0, { message: "Informe o nome do titular.", path: ["holderName"] });

export type PaymentDetailsValues = z.infer<typeof paymentDetailsSchema>;
