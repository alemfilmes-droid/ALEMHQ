import { z } from "zod";
import { PAYABLE_CATEGORIES, PAYABLE_RECURRENCES, PAYMENT_METHODS } from "@/features/finance/labels";
import { parseMoneyToCents } from "@/features/finance/money";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const optionalIsoDate = isoDate.or(z.literal(""));
const optionalUuid = z.string().uuid().or(z.literal(""));
const method = z.enum(PAYMENT_METHODS).or(z.literal(""));

const money = z
  .string()
  .trim()
  .min(1, "Informe o valor.")
  .refine((value) => {
    const cents = parseMoneyToCents(value);
    return cents !== null && cents > 0;
  }, "Informe um valor maior que zero.");

const intString = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `Informe ${label}.`)
    .refine((value) => Number(value) >= min && Number(value) <= max, `Use de ${min} a ${max}.`);

export const receivableSchema = z.object({
  companyId: z.string().uuid("Selecione o cliente."),
  projectId: optionalUuid,
  description: z.string().trim().min(2, "Informe a descrição.").max(160, "Use até 160 caracteres."),
  serviceDescription: z.string().trim().max(200, "Use até 200 caracteres."),
  competenceMonth: optionalIsoDate,
  /** Valor da parcela (1 parcela) ou valor total (mais de 1). */
  amount: money,
  installments: intString("o número de parcelas", 1, 120),
  intervalDays: intString("o intervalo em dias", 1, 365),
  dueDate: isoDate,
  paymentMethod: method,
  invoiceNumber: z.string().trim().max(40, "Use até 40 caracteres."),
  notes: z.string().trim().max(500, "Use até 500 caracteres."),
});

export const settleReceivableSchema = z.object({
  receivedAt: isoDate,
  receivedAmount: money,
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecione a forma de pagamento." }),
  invoiceNumber: z.string().trim().max(40, "Use até 40 caracteres."),
});

/** Escolha inicial do formulário: decide se o projeto é exigido, nunca uma coluna do banco. */
export const PAYABLE_COST_TYPES = ["empresa", "projeto"] as const;
export type PayableCostType = (typeof PAYABLE_COST_TYPES)[number];

export const payableSchema = z
  .object({
    costType: z.enum(PAYABLE_COST_TYPES),
    projectId: optionalUuid,
    companyId: optionalUuid,
    payeeProfileId: optionalUuid,
    payeeName: z.string().trim().max(120, "Use até 120 caracteres."),
    category: z.enum(PAYABLE_CATEGORIES, { message: "Selecione a categoria." }),
    description: z.string().trim().min(2, "Informe a descrição.").max(160, "Use até 160 caracteres."),
    amount: money,
    dueDate: isoDate,
    paymentMethod: method,
    notes: z.string().trim().max(500, "Use até 500 caracteres."),
    isFixed: z.boolean(),
    recurrence: z.enum(PAYABLE_RECURRENCES),
    recurrenceUntil: optionalIsoDate,
  })
  .superRefine((data, ctx) => {
    if (!data.payeeProfileId && data.payeeName === "") {
      ctx.addIssue({ code: "custom", path: ["payeeName"], message: "Informe o favorecido." });
    }
    if (data.recurrence !== "none" && data.recurrenceUntil && data.recurrenceUntil < data.dueDate) {
      ctx.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "Deve ser depois do vencimento." });
    }
    if (data.costType === "projeto" && data.projectId === "") {
      ctx.addIssue({ code: "custom", path: ["projectId"], message: "Selecione o projeto." });
    }
  });

export const settlePayableSchema = z.object({
  paidAt: isoDate,
  paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecione a forma de pagamento." }),
});

export const projectInstallmentsSchema = z.object({
  installments: intString("o número de parcelas", 1, 120),
  firstDueDate: isoDate,
  intervalDays: intString("o intervalo em dias", 1, 365),
  paymentMethod: method,
});

export type ReceivableValues = z.infer<typeof receivableSchema>;
export type SettleReceivableValues = z.infer<typeof settleReceivableSchema>;
export type PayableValues = z.infer<typeof payableSchema>;
export type SettlePayableValues = z.infer<typeof settlePayableSchema>;
export type ProjectInstallmentsValues = z.infer<typeof projectInstallmentsSchema>;
