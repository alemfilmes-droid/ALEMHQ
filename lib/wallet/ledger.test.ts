import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cases from "@/lib/wallet/ledger-cases.json";
import {
  ledgerTransition,
  receivedInYear,
  reversedPayoutIds,
  statementForMonth,
  type LedgerEvent,
  type LedgerPayable,
  type OpenPayout,
} from "@/lib/wallet/ledger";
import { buildWallet, type WalletEntry } from "@/lib/wallet/wallet";

const NOW = "2026-10-13T17:45:00.000Z";
const ctx = { now: NOW, today: "2026-10-13", actorId: "fin" };

/** Os mesmos casos foram conferidos contra o gatilho public.payables_wallet_ledger (validação da migração). */
describe("Extrato da Carteira: baixa e estorno", () => {
  for (const item of cases) {
    it(item.name, () => {
      const events = ledgerTransition(item.open as OpenPayout | null, item.payable as LedgerPayable, ctx);
      assert.deepEqual(
        events.map(({ actorId, ...rest }) => {
          assert.equal(actorId, "fin");
          return rest;
        }),
        item.expected.map((event) => ({ ...event, occurredAt: event.occurredAt === "NOW" ? NOW : event.occurredAt })),
      );
    });
  }

  it("baixa tira o valor de A receber e o estorno devolve", () => {
    const entry: WalletEntry = {
      id: "pa1",
      description: "Comissão",
      amountCents: 10_000,
      dueDate: "2026-10-05",
      payoutDate: "2026-10-10",
      paidAt: null,
      companyName: null,
      projectName: null,
      goalTitle: null,
      teamType: "comissao",
      category: "pessoal",
      isFixed: false,
      hasGoal: false,
      hasProject: false,
      createdAt: null,
    };
    const payable: LedgerPayable = { payeeId: "p1", amountCents: 10_000, paidAt: null, cancelled: false, reimbursement: false };

    assert.equal(buildWallet([entry], null, "2026-10-01").toReceive.length, 1);

    const [payout] = ledgerTransition(null, { ...payable, paidAt: "2026-10-13" }, ctx);
    assert.equal(payout?.kind, "payout");
    assert.equal(buildWallet([{ ...entry, paidAt: "2026-10-13" }], null, "2026-10-01").toReceive.length, 0);

    const open: OpenPayout = { id: "e1", profileId: "p1", amountCents: 10_000, paidOn: "2026-10-13", occurredAt: NOW, timeRecorded: true };
    const [reversal] = ledgerTransition(open, payable, ctx);
    assert.equal(reversal?.kind, "reversal");
    assert.equal(reversal?.reversesEventId, "e1");
    const back = buildWallet([entry], null, "2026-10-01");
    assert.deepEqual(back.toReceive.map((group) => group.totalCents), [10_000]);
  });
});

const event = (overrides: Partial<LedgerEvent>): LedgerEvent => ({
  id: "e",
  payableId: "pa",
  kind: "payout",
  amountCents: 10_000,
  paidOn: "2026-10-06",
  occurredAt: "2026-10-06T15:00:00.000Z",
  timeRecorded: true,
  actorName: null,
  reversesEventId: null,
  description: "Comissão",
  companyName: null,
  projectName: null,
  goalTitle: null,
  category: "pessoal",
  teamType: "comissao",
  isFixed: false,
  hasGoal: false,
  hasProject: false,
  dueDate: null,
  payoutDate: null,
  entryCreatedAt: null,
  ...overrides,
});

describe("Extrato da Carteira: totais por mês", () => {
  const events = [
    event({ id: "a", amountCents: 200_000, occurredAt: "2026-10-06T15:00:00.000Z" }),
    event({ id: "b", amountCents: 50_000, occurredAt: "2026-10-12T20:10:00.000Z" }),
    event({ id: "c", kind: "reversal", amountCents: 50_000, reversesEventId: "b", occurredAt: "2026-10-13T12:00:00.000Z" }),
    event({ id: "d", amountCents: 30_000, occurredAt: "2026-09-30T15:00:00.000Z" }),
    // 30/09 às 22:30 em Fortaleza = 01:30 UTC de 01/10: conta em setembro.
    event({ id: "e", amountCents: 1_000, occurredAt: "2026-10-01T01:30:00.000Z" }),
    event({ id: "f", amountCents: 7_000, occurredAt: "2025-12-20T15:00:00.000Z" }),
  ];

  it("total do mês é saídas menos estornos, do mais recente ao mais antigo", () => {
    const october = statementForMonth(events, "2026-10");
    assert.deepEqual(october.events.map((item) => item.id), ["c", "b", "a"]);
    assert.equal(october.payoutsCents, 250_000);
    assert.equal(october.reversalsCents, 50_000);
    assert.equal(october.totalCents, 200_000);
  });

  it("o mês segue o horário de Fortaleza", () => {
    assert.deepEqual(statementForMonth(events, "2026-09").events.map((item) => item.id), ["e", "d"]);
    assert.equal(statementForMonth(events, "2026-09").totalCents, 31_000);
  });

  it("mês sem movimento fica zerado", () => {
    assert.deepEqual(statementForMonth(events, "2026-11"), { events: [], totalCents: 0, payoutsCents: 0, reversalsCents: 0 });
  });

  it("recebido no ano e saídas estornadas", () => {
    assert.equal(receivedInYear(events, "2026"), 231_000);
    assert.equal(receivedInYear(events, "2025"), 7_000);
    assert.deepEqual([...reversedPayoutIds(events)], ["b"]);
  });
});
