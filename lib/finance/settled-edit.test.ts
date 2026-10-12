import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEditSettled, diffEntry, formatHistoryValue, historyFieldLabel, isConflictMessage, needsReason, SETTLED_FIELDS, settledDbErrorMessage } from "@/lib/finance/settled-edit";

const PAID = {
  description: "Diária de câmera",
  category: "freelancer",
  is_fixed: false,
  company_id: null,
  project_id: "p1",
  payee_profile_id: null,
  payee_name: "João",
  amount: 450,
  due_date: "2026-10-01",
  notes: null,
  paid_at: "2026-10-01",
  payment_method: "pix",
  payment_receipt_url: null,
};

describe("diffEntry", () => {
  it("cada tipo de campo: texto, categoria, booleano, id, valor, data, forma", () => {
    const changes = diffEntry("payable", PAID, {
      ...PAID,
      description: "Diária de câmera (2 dias)",
      category: "equipamento",
      is_fixed: true,
      project_id: "p2",
      amount: 900,
      due_date: "2026-10-02",
      paid_at: "2026-10-02",
      payment_method: "transferencia",
    });
    assert.deepEqual(Object.keys(changes).sort(), ["amount", "category", "description", "due_date", "is_fixed", "paid_at", "payment_method", "project_id"]);
    assert.deepEqual(changes.amount, { before: 450, after: 900 });
  });

  it("vazio e nulo são iguais; 450 e 450.00 também (como no banco)", () => {
    assert.deepEqual(diffEntry("payable", PAID, { ...PAID, notes: "", amount: 450.0 }), {});
  });

  it("campo fora da lista (recorrência, versão) é ignorado", () => {
    assert.deepEqual(diffEntry("payable", PAID, { ...PAID, recurrence: "monthly", version: 99 }), {});
    assert.equal(SETTLED_FIELDS.payable.includes("recurrence"), false);
  });

  it("recebimento: valor recebido e data entram na diferença", () => {
    const before = { received_at: "2026-10-01", received_amount: 200, invoice_number: null };
    const changes = diffEntry("receivable", before, { ...before, received_amount: 180, invoice_number: "NF 12" });
    assert.deepEqual(Object.keys(changes).sort(), ["invoice_number", "received_amount"]);
  });
});

describe("needsReason", () => {
  it("valor ou data de pagamento: motivo obrigatório", () => {
    assert.equal(needsReason("payable", diffEntry("payable", PAID, { ...PAID, amount: 500 })), true);
    assert.equal(needsReason("payable", diffEntry("payable", PAID, { ...PAID, paid_at: "2026-09-30" })), true);
    assert.equal(needsReason("receivable", { received_amount: { before: 1, after: 2 } }), true);
  });
  it("outros campos: motivo opcional", () => {
    assert.equal(needsReason("payable", diffEntry("payable", PAID, { ...PAID, description: "Outra", notes: "x" })), false);
  });
});

describe("canEditSettled (espelho do banco)", () => {
  it("diretoria e financeiro editam; audiovisual e comercial não", () => {
    assert.equal(canEditSettled(["diretoria"]), true);
    assert.equal(canEditSettled(["financeiro"]), true);
    assert.equal(canEditSettled(["audiovisual", "comercial"]), false);
    assert.equal(canEditSettled([]), false);
  });
});

describe("histórico: antes → depois", () => {
  it("formata valor, data, forma, categoria, booleano e nomes", () => {
    assert.equal(historyFieldLabel("paid_at"), "Data do pagamento");
    assert.match(formatHistoryValue("amount", 150), /R\$\s?150,00/);
    assert.equal(formatHistoryValue("paid_at", "2026-10-01"), "01/10/2026");
    assert.equal(formatHistoryValue("payment_method", "pix"), "Pix");
    assert.equal(formatHistoryValue("is_fixed", true), "Sim");
    assert.equal(formatHistoryValue("notes", null), "—");
    assert.equal(formatHistoryValue("project_id", "p1", () => "Campanha X"), "Campanha X");
  });
});

describe("settledDbErrorMessage", () => {
  it("conflito mostra quem alterou, como veio do banco", () => {
    const message = "Este lançamento foi alterado por Anna Clara agora há pouco. Recarregue para ver a versão atual.";
    assert.equal(settledDbErrorMessage({ code: "HQ409", message }), message);
  });
  it("permissão negada no servidor chega clara", () => {
    assert.match(settledDbErrorMessage({ code: "42501", message: "Só a diretoria e o squad financeiro alteram lançamentos baixados." }), /diretoria e o squad financeiro/);
  });
  it("erro técnico não vaza", () => {
    assert.match(settledDbErrorMessage({ code: "XX000", message: "internal" }), /Nada foi alterado/);
  });
});

describe("isConflictMessage", () => {
  it("reconhece o aviso de conflito do banco", () => {
    assert.equal(isConflictMessage("Este lançamento foi alterado por Anna Clara agora há pouco. Recarregue para ver a versão atual."), true);
    assert.equal(isConflictMessage("Informe o motivo do estorno."), false);
  });
});
