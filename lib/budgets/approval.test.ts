import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMonthsKeepingDay,
  approvalInputSchema,
  approvalPreview,
  budgetMarginWarning,
  buildApprovalPayload,
  checkInstallments,
  runApproval,
  suggestInstallments,
  type ApprovalInput,
  type ApprovalPayload,
  type ApprovalRpc,
} from "@/lib/budgets/approval";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const FINANCE_PERSON = "44444444-4444-4444-8444-444444444444";
const ITEM_A = "55555555-5555-4555-8555-555555555555";
const ITEM_B = "66666666-6666-4666-8666-666666666666";

const budget = { totalCents: 275_600, dealCompanyId: null, itemIds: [ITEM_A, ITEM_B] };
const schedule = (installments: { amountCents: number; dueDate: string }[]) => ({ mode: "schedule" as const, method: "pix" as const, installments });

function build(input: ApprovalInput, facts = budget) {
  const result = buildApprovalPayload(input, facts);
  if (!result.ok) assert.fail(result.error);
  return result.payload;
}

describe("aprovação com cliente existente", () => {
  it("liga cliente e projeto existentes e cria a parcela única", () => {
    const payload = build({
      company: { mode: "existing", id: COMPANY },
      project: { mode: "existing", id: PROJECT },
      payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]),
    });
    assert.deepEqual(payload.company, { mode: "existing", id: COMPANY });
    assert.deepEqual(payload.project, { mode: "existing", id: PROJECT });
    assert.deepEqual(payload.payment, { mode: "schedule", method: "pix", installments: [{ amount: 2756, due_date: "2026-11-10" }] });
  });

  it("orçamento do CRM: o cliente tem de ser o do negócio", () => {
    const facts = { ...budget, dealCompanyId: COMPANY };
    const ok = buildApprovalPayload({ company: { mode: "existing", id: COMPANY }, project: { mode: "existing", id: PROJECT }, payment: { mode: "delegate", assigneeId: FINANCE_PERSON } }, facts);
    assert.equal(ok.ok, true);
    const wrong = buildApprovalPayload({ company: { mode: "existing", id: OTHER_COMPANY }, project: { mode: "existing", id: PROJECT }, payment: { mode: "delegate", assigneeId: FINANCE_PERSON } }, facts);
    assert.equal(wrong.ok, false);
    const created = buildApprovalPayload(
      { company: { mode: "new", name: "Outra" }, project: { mode: "new", name: "P", model: "transacional", stage: "planejamento", date: "2026-12-01" }, payment: { mode: "delegate", assigneeId: FINANCE_PERSON } },
      facts,
    );
    assert.equal(created.ok, false);
  });
});

describe("aprovação criando cliente novo", () => {
  it("cria cliente (CNPJ opcional, segmento, origem) e projeto", () => {
    const payload = build({
      company: { mode: "new", name: "  Clínica Sol  ", segment: "Saúde", source: "indicacao" },
      project: { mode: "new", name: "Institucional 2026", model: "recorrente", stage: "pre_producao", date: "2026-11-01" },
      payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]),
    });
    assert.deepEqual(payload.company, { mode: "new", name: "Clínica Sol", document: "", segment: "Saúde", source: "indicacao" });
    assert.deepEqual(payload.project, { mode: "new", name: "Institucional 2026", model: "recorrente", stage: "pre_producao", date: "2026-11-01" });
  });

  it("cliente novo não pode usar projeto existente; nome é obrigatório", () => {
    const existingProject = buildApprovalPayload(
      { company: { mode: "new", name: "Clínica Sol" }, project: { mode: "existing", id: PROJECT }, payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]) },
      budget,
    );
    assert.equal(existingProject.ok, false);
    const noName = buildApprovalPayload(
      { company: { mode: "new", name: " " }, project: { mode: "new", name: "P1", model: "transacional", stage: "planejamento", date: "2026-12-01" }, payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]) },
      budget,
    );
    assert.equal(noName.ok, false);
  });
});

describe("parcelas", () => {
  it("divisão em parcelas iguais soma exatamente o total (centavos nas primeiras)", () => {
    const parts = suggestInstallments(100_000, 3, "2026-11-10");
    assert.deepEqual(parts.map((part) => part.amountCents), [33_334, 33_333, 33_333]);
    assert.deepEqual(parts.map((part) => part.dueDate), ["2026-11-10", "2026-12-10", "2027-01-10"]);
    for (const [total, count] of [[275_600, 7], [1, 1], [999_999, 12], [10, 3]] as const) {
      const split = suggestInstallments(total, count, "2026-01-31");
      assert.equal(split.reduce((sum, part) => sum + part.amountCents, 0), total);
      assert.equal(checkInstallments(total, split).ok, total >= count);
    }
  });

  it("mesmo dia no mês seguinte, ajustando fim de mês", () => {
    assert.equal(addMonthsKeepingDay("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonthsKeepingDay("2028-01-31", 1), "2028-02-29");
    assert.equal(addMonthsKeepingDay("2026-12-15", 2), "2027-02-15");
  });

  it("soma diferente do total, valor zero ou data vazia bloqueiam", () => {
    const short = checkInstallments(275_600, [{ amountCents: 100_000, dueDate: "2026-11-10" }, { amountCents: 175_599, dueDate: "2026-12-10" }]);
    assert.equal(short.ok, false);
    assert.equal(short.differenceCents, 1);
    assert.equal(checkInstallments(275_600, [{ amountCents: 275_600, dueDate: "" }]).ok, false);
    assert.equal(checkInstallments(275_600, [{ amountCents: 0, dueDate: "2026-11-10" }, { amountCents: 275_600, dueDate: "2026-12-10" }]).ok, false);
    const over = buildApprovalPayload(
      { company: { mode: "existing", id: COMPANY }, project: { mode: "existing", id: PROJECT }, payment: schedule([{ amountCents: 200_000, dueDate: "2026-11-10" }, { amountCents: 100_000, dueDate: "2026-12-10" }]) },
      budget,
    );
    assert.equal(over.ok, false);
  });

  it("valores vão ao banco em reais exatos (sem erro de ponto flutuante)", () => {
    const parts = suggestInstallments(100_001, 3, "2026-11-10");
    const payload = build({ company: { mode: "existing", id: COMPANY }, project: { mode: "existing", id: PROJECT }, payment: schedule(parts) }, { ...budget, totalCents: 100_001 });
    assert.equal(JSON.stringify(payload.payment), '{"mode":"schedule","method":"pix","installments":[{"amount":333.34,"due_date":"2026-11-10"},{"amount":333.34,"due_date":"2026-12-10"},{"amount":333.33,"due_date":"2027-01-10"}]}');
  });
});

describe("delegar a data de pagamento", () => {
  it("cria a pauta para a pessoa do financeiro e o recebimento “Data a definir” com o total", () => {
    const input: ApprovalInput = { company: { mode: "existing", id: COMPANY }, project: { mode: "existing", id: PROJECT }, payment: { mode: "delegate", assigneeId: FINANCE_PERSON } };
    const payload = build(input);
    assert.deepEqual(payload.payment, { mode: "delegate", assignee_id: FINANCE_PERSON });
    const preview = approvalPreview(approvalInputSchema.parse(input), { ...budget, number: 12, label: "Orçamento nº 0012", items: [], hasDeal: false });
    assert.deepEqual(preview.receivables, [{ amountCents: 275_600, dueDate: null, status: "data_a_definir", label: "Orçamento nº 0012" }]);
    assert.deepEqual(preview.pautas, [{ kind: "definir_data", title: "Definir data de pagamento — Orçamento #0012", assigneeId: FINANCE_PERSON }]);
  });

  it("sem pessoa escolhida não dá para delegar", () => {
    const result = buildApprovalPayload({ company: { mode: "existing", id: COMPANY }, project: { mode: "existing", id: PROJECT }, payment: { mode: "delegate", assigneeId: "" } }, budget);
    assert.equal(result.ok, false);
  });
});

describe("custos do orçamento NÃO vão para o projeto", () => {
  it("o pedido leva só ids de itens para pauta — nenhum custo, preço ou quantidade", () => {
    const payload = build({
      company: { mode: "existing", id: COMPANY },
      project: { mode: "existing", id: PROJECT },
      pautaItemIds: [ITEM_A, ITEM_A],
      payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]),
    });
    assert.deepEqual(payload.pauta_item_ids, [ITEM_A]);
    const json = JSON.stringify(payload);
    for (const key of ["cost", "unit_cost", "unitCost", "price", "quantity", "payables", "fee"]) assert.equal(json.includes(key), false, key);
  });

  it("a prévia não lança custo nenhum no projeto e a pauta leva só a descrição do item", () => {
    const values = approvalInputSchema.parse({
      company: { mode: "existing", id: COMPANY },
      project: { mode: "existing", id: PROJECT },
      pautaItemIds: [ITEM_B],
      payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]),
    });
    const preview = approvalPreview(values, {
      ...budget,
      number: 7,
      label: "Orçamento nº 0007",
      hasDeal: true,
      items: [
        { id: ITEM_A, description: "Diretor(a)" },
        { id: ITEM_B, description: "Locação de equipamento" },
      ],
    });
    assert.deepEqual(preview.projectCosts, []);
    assert.deepEqual(preview.pautas, [{ kind: "item", title: "Locação de equipamento", assigneeId: null }]);
    assert.equal(preview.dealWon, true);
  });

  it("item de outro orçamento é recusado", () => {
    const result = buildApprovalPayload(
      { company: { mode: "existing", id: COMPANY }, project: { mode: "existing", id: PROJECT }, pautaItemIds: [FINANCE_PERSON], payment: schedule([{ amountCents: 275_600, dueDate: "2026-11-10" }]) },
      budget,
    );
    assert.equal(result.ok, false);
  });
});

describe("transação: falhou, nada foi criado", () => {
  const payload: ApprovalPayload = {
    note: "",
    company: { mode: "new", name: "Clínica Sol", document: "", segment: "", source: null },
    project: { mode: "new", name: "P1", model: "transacional", stage: "planejamento", date: "2026-12-01" },
    pauta_item_ids: [],
    payment: { mode: "schedule", method: null, installments: [{ amount: 2756, due_date: "2026-11-10" }] },
  };

  it("erro no banco: uma única chamada (approve_budget), sem gravações parciais nem tentativas extras", async () => {
    const calls: string[] = [];
    const rpc: ApprovalRpc = async (budgetId) => {
      calls.push(budgetId);
      return { data: null, error: { message: "null value in column owner_id", code: "23502" } };
    };
    const result = await runApproval(rpc, "b1", payload);
    assert.deepEqual(calls, ["b1"]);
    assert.deepEqual(result, { ok: false, error: "Não foi possível aprovar. Nada foi criado — tente de novo." });
  });

  it("erro de regra do banco chega em português para a pessoa", async () => {
    const rpc: ApprovalRpc = async () => ({ data: null, error: { message: "A soma das parcelas (R$ 1,00) precisa ser igual ao total do orçamento (R$ 2.756,00).", code: "23514" } });
    const result = await runApproval(rpc, "b1", payload);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /soma das parcelas/);
  });

  it("sucesso devolve o que foi criado", async () => {
    const rpc: ApprovalRpc = async () => ({
      data: { company_id: COMPANY, project_id: PROJECT, receivable_ids: ["r1", "r2"], pauta_ids: [], deal_id: null, deal_result: "sem_crm", contract_set: true },
      error: null,
    });
    const result = await runApproval(rpc, "b1", payload);
    assert.deepEqual(result, {
      ok: true,
      outcome: { companyId: COMPANY, projectId: PROJECT, receivableIds: ["r1", "r2"], pautaIds: [], dealId: null, dealResult: "sem_crm", contractSet: true },
    });
  });
});

describe("aviso de margem (só informativo)", () => {
  it("abaixo de 30% avisa; 30% ou mais não", () => {
    assert.match(budgetMarginWarning(0.2349) ?? "", /23,5%.*abaixo de 30%/);
    assert.equal(budgetMarginWarning(0.3), null);
    assert.equal(budgetMarginWarning(0.45), null);
  });
});
