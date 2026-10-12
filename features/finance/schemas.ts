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
  /** Nota fiscal: Não = o financeiro não recebe a tarefa automática de emitir a nota. */
  requiresInvoice: z.boolean(),
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

const payableObject = z.object({
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
  // Dados de pagamento do favorecido avulso (sem cadastro). Membro da equipe: vêm do perfil dele.
  payeePixKeyType: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).or(z.literal("")),
  payeePixKey: z.string().trim().max(160),
  payeeHolderName: z.string().trim().max(160),
  payeeDocument: z.string().trim().max(20),
  payeeBankName: z.string().trim().max(120),
  payeeBankAgency: z.string().trim().max(20),
  payeeBankAccount: z.string().trim().max(30),
  payeeAccountType: z.enum(["corrente", "poupanca", "pagamento"]).or(z.literal("")),
});

/** Regras de criação/edição do pagamento — as mesmas valem na edição de um lançamento já baixado. */
function payableRules(data: z.infer<typeof payableObject>, ctx: z.RefinementCtx) {
  if (!data.payeeProfileId && data.payeeName === "") {
    ctx.addIssue({ code: "custom", path: ["payeeName"], message: "Informe o favorecido." });
  }
  if (data.recurrence !== "none" && data.recurrenceUntil && data.recurrenceUntil < data.dueDate) {
    ctx.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "Deve ser depois do vencimento." });
  }
  if (data.costType === "projeto" && data.projectId === "") {
    ctx.addIssue({ code: "custom", path: ["projectId"], message: "Selecione o projeto." });
  }
}

export const payableSchema = payableObject.superRefine(payableRules);

/**
 * Baixa do pagamento. Depois do vencimento: motivo obrigatório; multa/juros opcional (com motivo).
 * `dueDate` vem do pagamento para validar o atraso aqui — o banco repete a regra.
 */
export const settlePayableSchema = z
  .object({
    paidAt: isoDate,
    dueDate: isoDate,
    paymentMethod: z.enum(PAYMENT_METHODS, { message: "Selecione a forma de pagamento." }),
    receiptUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use um link começando com http(s)://."),
    lateReason: z.string().trim().max(500, "Use até 500 caracteres."),
    hadPenalty: z.boolean(),
    penaltyAmount: z.string().trim(),
    penaltyReason: z.string().trim().max(500, "Use até 500 caracteres."),
  })
  .superRefine((data, ctx) => {
    const late = data.paidAt > data.dueDate;
    if (late && data.lateReason.length < 3) ctx.addIssue({ code: "custom", path: ["lateReason"], message: "Pagamento depois do vencimento: informe o motivo." });
    if (late && data.hadPenalty) {
      const cents = parseMoneyToCents(data.penaltyAmount);
      if (cents === null || cents <= 0) ctx.addIssue({ code: "custom", path: ["penaltyAmount"], message: "Informe o valor da multa/juros." });
      if (data.penaltyReason.length < 3) ctx.addIssue({ code: "custom", path: ["penaltyReason"], message: "Informe o motivo da multa/juros." });
    }
  });

export const projectInstallmentsSchema = z.object({
  installments: intString("o número de parcelas", 1, 120),
  firstDueDate: isoDate,
  intervalDays: intString("o intervalo em dias", 1, 365),
  paymentMethod: method,
});

// ---------------------------------------------------------------------------
// Edição de lançamento já baixado: os mesmos campos e regras da criação, mais os dados da baixa e o
// motivo (obrigatório quando valor ou data de pagamento mudam — a tela e o banco conferem).
// ---------------------------------------------------------------------------

const changeReason = z.string().trim().max(500, "Use até 500 caracteres.");
const requiredMethod = z.enum(PAYMENT_METHODS, { message: "Selecione a forma de pagamento." });
const receiptUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use um link começando com http(s)://.");

export const settledPayableSchema = payableObject
  .extend({
    paymentMethod: requiredMethod,
    paidAt: isoDate,
    receiptUrl,
    lateReason: z.string().trim().max(500, "Use até 500 caracteres."),
    penaltyAmount: z.string().trim(),
    penaltyReason: z.string().trim().max(500, "Use até 500 caracteres."),
    reason: changeReason,
  })
  .superRefine((data, ctx) => {
    payableRules(data, ctx);
    if (data.paidAt > data.dueDate && data.lateReason.length < 3) {
      ctx.addIssue({ code: "custom", path: ["lateReason"], message: "Pagamento depois do vencimento: informe o motivo." });
    }
    if (data.penaltyAmount !== "") {
      const cents = parseMoneyToCents(data.penaltyAmount);
      if (cents === null || cents <= 0) ctx.addIssue({ code: "custom", path: ["penaltyAmount"], message: "Informe um valor maior que zero." });
      if (data.penaltyReason.length < 3) ctx.addIssue({ code: "custom", path: ["penaltyReason"], message: "Informe o motivo da multa/juros." });
    }
  });

export const settledReceivableSchema = receivableSchema.omit({ installments: true, intervalDays: true }).extend({
  paymentMethod: requiredMethod,
  receivedAt: isoDate,
  receivedAmount: money,
  reason: changeReason,
});

export const reverseSettlementSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo do estorno.").max(500, "Use até 500 caracteres."),
});

export type ReceivableValues = z.infer<typeof receivableSchema>;
export type SettleReceivableValues = z.infer<typeof settleReceivableSchema>;
export type PayableValues = z.infer<typeof payableSchema>;
export type SettlePayableValues = z.infer<typeof settlePayableSchema>;
export type ProjectInstallmentsValues = z.infer<typeof projectInstallmentsSchema>;
export type SettledPayableValues = z.infer<typeof settledPayableSchema>;
export type SettledReceivableValues = z.infer<typeof settledReceivableSchema>;
